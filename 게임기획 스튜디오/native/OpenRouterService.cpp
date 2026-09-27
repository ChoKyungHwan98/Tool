#include "OpenRouterService.h"

#include <Windows.h>
#include <WinCred.h>
#include <winhttp.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace {

using json = nlohmann::json;
constexpr wchar_t kCredentialTarget[] = L"GameDesignStudio.OpenRouter";

std::wstring utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) throw std::runtime_error("OpenRouter text conversion failed.");
  std::wstring result(static_cast<std::size_t>(size), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size);
  return result;
}

struct InternetHandle {
  HINTERNET value = nullptr;
  ~InternetHandle() { if (value) WinHttpCloseHandle(value); }
};

double finiteNumber(const json& value, const char* key, double fallback) {
  if (!value.contains(key) || !value[key].is_number()) return fallback;
  const double number = value[key].get<double>();
  return std::isfinite(number) ? number : fallback;
}

} // namespace

OpenRouterService::OpenRouterService(std::filesystem::path appDataDirectory)
  : usagePath_(std::move(appDataDirectory) / L"ai-usage.json") {}

std::string OpenRouterService::readApiKey() {
  PCREDENTIALW credential = nullptr;
  if (!CredReadW(kCredentialTarget, CRED_TYPE_GENERIC, 0, &credential) || credential == nullptr) return {};
  const std::string key(
    reinterpret_cast<const char*>(credential->CredentialBlob),
    reinterpret_cast<const char*>(credential->CredentialBlob) + credential->CredentialBlobSize);
  CredFree(credential);
  return key;
}

void OpenRouterService::saveApiKey(const std::string& key) {
  if (key.size() < 10 || key.size() > 4096) throw std::runtime_error("OpenRouter API 키 형식이 올바르지 않습니다.");
  CREDENTIALW credential{};
  credential.Type = CRED_TYPE_GENERIC;
  credential.TargetName = const_cast<wchar_t*>(kCredentialTarget);
  credential.CredentialBlobSize = static_cast<DWORD>(key.size());
  credential.CredentialBlob = reinterpret_cast<LPBYTE>(const_cast<char*>(key.data()));
  credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
  credential.UserName = const_cast<wchar_t*>(L"OpenRouter");
  if (!CredWriteW(&credential, 0)) throw std::runtime_error("Windows 자격 증명 관리자에 API 키를 저장하지 못했습니다.");
}

void OpenRouterService::deleteApiKey() {
  if (!CredDeleteW(kCredentialTarget, CRED_TYPE_GENERIC, 0) && GetLastError() != ERROR_NOT_FOUND) {
    throw std::runtime_error("저장된 OpenRouter API 키를 삭제하지 못했습니다.");
  }
}

json OpenRouterService::request(
    const std::wstring& method,
    const std::wstring& path,
    const std::string& body,
    const std::string& apiKey) {
  InternetHandle session{WinHttpOpen(
    L"GameDesignStudio/0.1", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
    WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0)};
  if (!session.value) throw std::runtime_error("OpenRouter 네트워크 세션을 시작하지 못했습니다.");
  WinHttpSetTimeouts(session.value, 10000, 10000, 30000, 60000);
  InternetHandle connection{WinHttpConnect(session.value, L"openrouter.ai", INTERNET_DEFAULT_HTTPS_PORT, 0)};
  if (!connection.value) throw std::runtime_error("OpenRouter에 연결하지 못했습니다.");
  InternetHandle requestHandle{WinHttpOpenRequest(
    connection.value, method.c_str(), path.c_str(), nullptr, WINHTTP_NO_REFERER,
    WINHTTP_DEFAULT_ACCEPT_TYPES, WINHTTP_FLAG_SECURE)};
  if (!requestHandle.value) throw std::runtime_error("OpenRouter 요청을 만들지 못했습니다.");

  std::wstring headers = L"Accept: application/json\r\nContent-Type: application/json\r\nX-Title: Game Design Studio\r\n";
  if (!apiKey.empty()) headers += L"Authorization: Bearer " + utf8ToWide(apiKey) + L"\r\n";
  const bool sent = WinHttpSendRequest(
    requestHandle.value, headers.c_str(), static_cast<DWORD>(headers.size()),
    body.empty() ? WINHTTP_NO_REQUEST_DATA : const_cast<char*>(body.data()),
    static_cast<DWORD>(body.size()), static_cast<DWORD>(body.size()), 0);
  if (!sent || !WinHttpReceiveResponse(requestHandle.value, nullptr)) {
    throw std::runtime_error("OpenRouter 응답을 받지 못했습니다.");
  }
  DWORD status = 0;
  DWORD statusSize = sizeof(status);
  WinHttpQueryHeaders(requestHandle.value, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
    WINHTTP_HEADER_NAME_BY_INDEX, &status, &statusSize, WINHTTP_NO_HEADER_INDEX);
  std::string response;
  for (;;) {
    DWORD available = 0;
    if (!WinHttpQueryDataAvailable(requestHandle.value, &available)) throw std::runtime_error("OpenRouter 응답을 읽지 못했습니다.");
    if (available == 0) break;
    if (response.size() + available > 8 * 1024 * 1024) throw std::runtime_error("OpenRouter 응답이 허용 크기를 초과했습니다.");
    std::vector<char> buffer(available);
    DWORD read = 0;
    if (!WinHttpReadData(requestHandle.value, buffer.data(), available, &read)) throw std::runtime_error("OpenRouter 응답을 읽지 못했습니다.");
    response.append(buffer.data(), read);
  }
  json parsed;
  try { parsed = json::parse(response); }
  catch (...) { throw std::runtime_error("OpenRouter가 올바른 JSON을 반환하지 않았습니다."); }
  if (status < 200 || status >= 300) {
    const std::string message = parsed.contains("error") && parsed["error"].is_object()
      ? parsed["error"].value("message", "OpenRouter request failed.")
      : "OpenRouter request failed.";
    throw std::runtime_error("OpenRouter 오류 " + std::to_string(status) + ": " + message);
  }
  return parsed;
}

std::string OpenRouterService::monthKey() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t time = std::chrono::system_clock::to_time_t(now);
  std::tm local{};
  localtime_s(&local, &time);
  std::ostringstream stream;
  stream << std::put_time(&local, "%Y-%m");
  return stream.str();
}

json OpenRouterService::loadUsage() const {
  if (!std::filesystem::exists(usagePath_)) return {{"schemaVersion", 1}, {"months", json::object()}};
  std::ifstream stream(usagePath_);
  json usage;
  stream >> usage;
  if (!usage.is_object() || !usage.contains("months")) return {{"schemaVersion", 1}, {"months", json::object()}};
  return usage;
}

void OpenRouterService::saveUsage(const json& usage) const {
  std::filesystem::create_directories(usagePath_.parent_path());
  const auto temporary = usagePath_.wstring() + L".tmp";
  { std::ofstream stream(temporary, std::ios::trunc); stream << std::setw(2) << usage << '\n'; }
  if (!MoveFileExW(temporary.c_str(), usagePath_.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    DeleteFileW(temporary.c_str());
    throw std::runtime_error("AI 사용량 기록을 저장하지 못했습니다.");
  }
}

json OpenRouterService::budgetStatus(double monthlyLimit) const {
  const json usage = loadUsage();
  const double spent = usage["months"].value(monthKey(), 0.0);
  return {{"month", monthKey()}, {"limit", monthlyLimit}, {"spent", spent}, {"remaining", std::max(0.0, monthlyLimit - spent)}};
}

json OpenRouterService::handleCommand(const json& command) {
  const std::string type = command.value("type", "");
  const std::string requestId = command.value("requestId", "");
  const double monthlyLimit = std::clamp(finiteNumber(command, "monthlyLimit", 10.0), 0.0, 10000.0);
  if (type == "ai:keyStatus") return {{"type", "ai:keyStatus"}, {"requestId", requestId}, {"configured", !readApiKey().empty()}, {"budget", budgetStatus(monthlyLimit)}};
  if (type == "ai:keySave") {
    saveApiKey(command.value("key", ""));
    return {{"type", "ai:keyStatus"}, {"requestId", requestId}, {"configured", true}, {"budget", budgetStatus(monthlyLimit)}};
  }
  if (type == "ai:keyDelete") {
    deleteApiKey();
    return {{"type", "ai:keyStatus"}, {"requestId", requestId}, {"configured", false}, {"budget", budgetStatus(monthlyLimit)}};
  }
  if (type == "ai:models") {
    const json raw = request(L"GET", L"/api/v1/models", "", readApiKey());
    json models = json::array();
    if (raw.contains("data") && raw["data"].is_array()) {
      for (const auto& model : raw["data"]) {
        models.push_back({
          {"id", model.value("id", "")}, {"name", model.value("name", "")},
          {"contextLength", model.value("context_length", 0)},
          {"pricing", model.contains("pricing") ? model["pricing"] : json::object()},
          // 도구 호출 가능 여부를 도구가 직접 판단할 수 있게 넘긴다(테이블 디자이너 AI가 tools를 쓴다).
          {"supported_parameters", model.contains("supported_parameters") ? model["supported_parameters"] : json::array()},
          {"architecture", model.contains("architecture") ? model["architecture"] : json::object()}
        });
      }
    }
    return {{"type", "ai:models"}, {"requestId", requestId}, {"models", models}, {"budget", budgetStatus(monthlyLimit)}};
  }
  if (type == "ai:complete") {
    const std::string key = readApiKey();
    if (key.empty()) throw std::runtime_error("먼저 OpenRouter API 키를 저장해 주세요.");
    const double estimatedCost = std::max(0.0, finiteNumber(command, "estimatedCost", 0.0));
    const double perRequestLimit = std::clamp(finiteNumber(command, "perRequestLimit", 0.5), 0.0, monthlyLimit);
    const json before = budgetStatus(monthlyLimit);
    if (estimatedCost > perRequestLimit) throw std::runtime_error("예상 비용이 요청당 한도를 초과했습니다.");
    if (before.value("spent", 0.0) + estimatedCost > monthlyLimit) throw std::runtime_error("이번 달 AI 예산을 초과할 수 있어 요청을 차단했습니다.");
    json body = {
      {"model", command.value("model", "")},
      {"messages", command.contains("messages") ? command["messages"] : json::array()},
      {"temperature", std::clamp(finiteNumber(command, "temperature", 0.2), 0.0, 1.0)},
      {"max_completion_tokens", std::clamp(command.value("maxTokens", 1600), 128, 4096)}
    };
    // 도구 호출(function calling)을 쓰는 도구를 위해 tools를 그대로 전달한다.
    if (command.contains("tools") && command["tools"].is_array() && !command["tools"].empty()) {
      body["tools"] = command["tools"];
      body["tool_choice"] = "auto";
    }
    const json result = request(L"POST", L"/api/v1/chat/completions", body.dump(), key);
    double actualCost = estimatedCost;
    if (result.contains("usage") && result["usage"].is_object() && result["usage"].contains("cost") && result["usage"]["cost"].is_number()) {
      actualCost = std::max(0.0, result["usage"]["cost"].get<double>());
    }
    json usage = loadUsage();
    usage["months"][monthKey()] = usage["months"].value(monthKey(), 0.0) + actualCost;
    saveUsage(usage);
    return {{"type", "ai:response"}, {"requestId", requestId}, {"result", result}, {"charged", actualCost}, {"budget", budgetStatus(monthlyLimit)}};
  }
  throw std::runtime_error("지원하지 않는 AI 명령입니다.");
}
