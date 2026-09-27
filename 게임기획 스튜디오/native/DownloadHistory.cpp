#include "DownloadHistory.h"

#include <Windows.h>
#include <objbase.h>
#include <shellapi.h>

#include <chrono>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace {
// 오래된 기록부터 지운다. 파일은 그대로 둔다.
constexpr std::size_t kMaxItems = 200;
}

DownloadHistory::DownloadHistory(std::filesystem::path appDataDirectory)
  : path_(std::move(appDataDirectory) / L"downloads.json"),
    items_(json::array()) {
  load();
}

void DownloadHistory::load() {
  try {
    std::ifstream stream(path_, std::ios::binary);
    if (!stream) return;
    const json value = json::parse(stream);
    if (value.contains("items") && value["items"].is_array()) items_ = value["items"];
  } catch (...) {
    items_ = json::array();  // 깨진 기록은 버리고 새로 시작한다.
  }
}

void DownloadHistory::save() const {
  std::filesystem::create_directories(path_.parent_path());
  const std::filesystem::path temporary = path_.wstring() + L".tmp";
  {
    std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
    if (!stream) return;
    stream << json{{"version", 1}, {"items", items_}}.dump(2);
  }
  MoveFileExW(temporary.c_str(), path_.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
}

nlohmann::json* DownloadHistory::find(const std::string& id) {
  for (auto& item : items_) {
    if (item.value("id", "") == id) return &item;
  }
  return nullptr;
}

std::string DownloadHistory::begin(const std::wstring& filePath, const std::wstring& sourceUrl, long long totalBytes) {
  const std::filesystem::path file(filePath);
  const std::string id = newId();
  items_.insert(items_.begin(), json{
    {"id", id},
    {"name", wideToUtf8(file.filename().wstring())},
    {"path", wideToUtf8(filePath)},
    {"source", wideToUtf8(sourceUrl).substr(0, 300)},
    {"totalBytes", totalBytes},
    {"receivedBytes", 0},
    {"state", "in_progress"},
    {"startedAt", nowIso8601()},
    {"finishedAt", nullptr},
  });
  while (items_.size() > kMaxItems) items_.erase(items_.end() - 1);
  save();
  return id;
}

void DownloadHistory::finish(const std::string& id, const std::string& state, long long receivedBytes) {
  json* item = find(id);
  if (!item) return;
  (*item)["state"] = state;
  (*item)["receivedBytes"] = receivedBytes;
  (*item)["finishedAt"] = nowIso8601();
  save();
}

nlohmann::json DownloadHistory::listMessage(const std::string& requestId) const {
  json items = json::array();
  for (const auto& item : items_) {
    json copy = item;
    // 파일이 옮겨지거나 지워졌는지 목록을 줄 때마다 확인한다.
    std::error_code ignored;
    copy["exists"] = std::filesystem::exists(std::filesystem::path(utf8ToWide(item.value("path", ""))), ignored);
    items.push_back(std::move(copy));
  }
  return {{"type", "downloads:list"}, {"requestId", requestId}, {"items", items}};
}

nlohmann::json DownloadHistory::handleCommand(const json& command) {
  const std::string type = command.value("type", "");
  const std::string requestId = command.value("requestId", "");
  const std::string id = command.value("id", "");

  if (type == "downloads:open" || type == "downloads:reveal") {
    json* item = find(id);
    if (!item) throw std::runtime_error("다운로드 기록을 찾을 수 없습니다.");
    const std::wstring file = utf8ToWide(item->value("path", ""));
    if (!std::filesystem::exists(std::filesystem::path(file))) {
      throw std::runtime_error("파일이 옮겨졌거나 지워졌습니다.");
    }
    if (type == "downloads:open") {
      ShellExecuteW(nullptr, L"open", file.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    } else {
      const std::wstring arguments = L"/select,\"" + file + L"\"";
      ShellExecuteW(nullptr, L"open", L"explorer.exe", arguments.c_str(), nullptr, SW_SHOWNORMAL);
    }
  } else if (type == "downloads:remove") {
    for (auto it = items_.begin(); it != items_.end(); ++it) {
      if (it->value("id", "") == id) { items_.erase(it); break; }
    }
    save();
  } else if (type == "downloads:clear") {
    items_ = json::array();
    save();
  } else if (type != "downloads:list") {
    throw std::runtime_error("지원하지 않는 다운로드 명령입니다: " + type);
  }
  return listMessage(requestId);
}

std::string DownloadHistory::nowIso8601() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t time = std::chrono::system_clock::to_time_t(now);
  std::tm utc{};
  gmtime_s(&utc, &time);
  std::ostringstream stream;
  stream << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return stream.str();
}

std::string DownloadHistory::newId() {
  GUID guid{};
  if (FAILED(CoCreateGuid(&guid))) return nowIso8601();
  wchar_t buffer[40]{};
  StringFromGUID2(guid, buffer, static_cast<int>(std::size(buffer)));
  std::wstring value(buffer);
  if (!value.empty() && value.front() == L'{') value.erase(value.begin());
  if (!value.empty() && value.back() == L'}') value.pop_back();
  return wideToUtf8(value);
}

std::string DownloadHistory::wideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  std::string result(static_cast<std::size_t>(size > 0 ? size : 0), '\0');
  if (size > 0) WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr);
  return result;
}

std::wstring DownloadHistory::utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  std::wstring result(static_cast<std::size_t>(size > 0 ? size : 0), L'\0');
  if (size > 0) MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), size);
  return result;
}
