#include "PromptLibraryStore.h"

#include <Windows.h>
#include <objbase.h>

#include <algorithm>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace {

using json = nlohmann::json;

std::string limitedString(const json& value, const char* key, std::size_t maximum) {
  if (!value.contains(key) || !value[key].is_string()) return {};
  std::string result = value[key].get<std::string>();
  if (result.size() > maximum) result.resize(maximum);
  return result;
}

json normalizeTags(const json& value) {
  json tags = json::array();
  if (!value.is_array()) return tags;
  for (const auto& tag : value) {
    if (!tag.is_string() || tags.size() >= 12) continue;
    std::string text = tag.get<std::string>();
    if (text.size() > 40) text.resize(40);
    if (!text.empty() && std::find(tags.begin(), tags.end(), text) == tags.end()) tags.push_back(text);
  }
  return tags;
}

json normalizeDefaults(const json& value) {
  json defaults = json::object();
  if (!value.is_object()) return defaults;
  for (const auto& [key, entry] : value.items()) {
    if (defaults.size() >= 24 || key.empty() || key.size() > 60 || !entry.is_string()) continue;
    std::string text = entry.get<std::string>();
    if (text.size() > 4000) text.resize(4000);
    defaults[key] = text;
  }
  return defaults;
}

} // namespace

PromptLibraryStore::PromptLibraryStore(std::filesystem::path appDataDirectory)
  : libraryPath_(std::move(appDataDirectory) / L"prompt-library.json"),
    sessionHistory_(json::array()) {
  load();
}

json PromptLibraryStore::defaultLibrary() {
  return {
    {"schemaVersion", 2},
    {"prompts", json::array()},
    {"settings", {
      {"copyOnUse", true},
      {"sortBy", "lastUsed"},
      {"historyLimit", 100}
    }},
    {"updatedAt", nowIso8601()}
  };
}

void PromptLibraryStore::load() {
  persistent_ = defaultLibrary();
  if (!std::filesystem::exists(libraryPath_)) {
    save();
    return;
  }
  try {
    std::ifstream stream(libraryPath_, std::ios::binary);
    if (!stream) throw std::runtime_error("프롬프트 보관함을 열 수 없습니다.");
    json loaded;
    stream >> loaded;
    if (!loaded.is_object() || !loaded.contains("prompts") || !loaded["prompts"].is_array()) {
      throw std::runtime_error("프롬프트 보관함 형식이 올바르지 않습니다.");
    }
    persistent_ = std::move(loaded);
    persistent_["schemaVersion"] = 2;
    for (auto& prompt : persistent_["prompts"]) {
      if (!prompt.contains("beginning") || !prompt["beginning"].is_string()) prompt["beginning"] = "";
      if (!prompt.contains("ending") || !prompt["ending"].is_string()) prompt["ending"] = "";
      if (!prompt.contains("negativePrompt") || !prompt["negativePrompt"].is_string()) prompt["negativePrompt"] = "";
      if (!prompt.contains("searchOptions") || !prompt["searchOptions"].is_string()) prompt["searchOptions"] = "";
      if (!prompt.contains("removeDuplicateTags") || !prompt["removeDuplicateTags"].is_boolean()) prompt["removeDuplicateTags"] = true;
    }
    if (!persistent_.contains("settings") || !persistent_["settings"].is_object()) {
      persistent_["settings"] = defaultLibrary()["settings"];
    }
  } catch (...) {
    const auto corrupt = libraryPath_.wstring() + L".corrupt";
    std::error_code ignored;
    std::filesystem::remove(corrupt, ignored);
    std::filesystem::rename(libraryPath_, corrupt, ignored);
    persistent_ = defaultLibrary();
    save();
  }
}

void PromptLibraryStore::save() const {
  writeJsonAtomically(libraryPath_, persistent_);
}

json PromptLibraryStore::response(const std::string& requestId) const {
  return {
    {"type", "prompt:state"},
    {"requestId", requestId},
    {"library", persistent_},
    {"history", sessionHistory_},
    {"historyPersistence", "process-memory"}
  };
}

json PromptLibraryStore::normalizePrompt(const json& prompt, const json* existing) {
  const std::string title = limitedString(prompt, "title", 160);
  const std::string content = limitedString(prompt, "content", 100000);
  if (title.empty()) throw std::runtime_error("프롬프트 이름을 입력해 주세요.");
  if (content.empty()) throw std::runtime_error("프롬프트 내용을 입력해 주세요.");
  const std::string now = nowIso8601();
  const std::string id = existing == nullptr ? newId() : existing->value("id", newId());
  return {
    {"id", id},
    {"title", title},
    {"description", limitedString(prompt, "description", 2000)},
    {"content", content},
    {"beginning", limitedString(prompt, "beginning", 100000)},
    {"ending", limitedString(prompt, "ending", 100000)},
    {"negativePrompt", limitedString(prompt, "negativePrompt", 100000)},
    {"searchOptions", limitedString(prompt, "searchOptions", 20000)},
    {"removeDuplicateTags", prompt.value("removeDuplicateTags", true)},
    {"category", limitedString(prompt, "category", 80)},
    {"tags", normalizeTags(prompt.value("tags", json::array()))},
    {"target", limitedString(prompt, "target", 80)},
    {"model", limitedString(prompt, "model", 160)},
    {"temperature", std::clamp(prompt.value("temperature", 0.2), 0.0, 2.0)},
    {"variableDefaults", normalizeDefaults(prompt.value("variableDefaults", json::object()))},
    {"createdAt", existing == nullptr ? now : existing->value("createdAt", now)},
    {"updatedAt", now},
    {"lastUsedAt", existing == nullptr ? json(nullptr) : existing->value("lastUsedAt", json(nullptr))},
    {"usageCount", existing == nullptr ? 0 : existing->value("usageCount", 0)}
  };
}

void PromptLibraryStore::savePrompt(const json& command) {
  if (!command.contains("prompt") || !command["prompt"].is_object()) {
    throw std::runtime_error("저장할 프롬프트가 없습니다.");
  }
  const std::string requestedId = command["prompt"].value("id", "");
  auto& prompts = persistent_["prompts"];
  auto found = std::find_if(prompts.begin(), prompts.end(), [&](const json& item) {
    return !requestedId.empty() && item.value("id", "") == requestedId;
  });
  if (found == prompts.end()) prompts.insert(prompts.begin(), normalizePrompt(command["prompt"], nullptr));
  else *found = normalizePrompt(command["prompt"], &(*found));
  persistent_["updatedAt"] = nowIso8601();
  save();
}

void PromptLibraryStore::deletePrompt(const json& command) {
  const std::string id = command.value("promptId", "");
  auto& prompts = persistent_["prompts"];
  prompts.erase(std::remove_if(prompts.begin(), prompts.end(), [&](const json& item) {
    return item.value("id", "") == id;
  }), prompts.end());
  persistent_["updatedAt"] = nowIso8601();
  save();
}

void PromptLibraryStore::updateSettings(const json& command) {
  if (!command.contains("settings") || !command["settings"].is_object()) return;
  const auto& input = command["settings"];
  auto& settings = persistent_["settings"];
  if (input.contains("copyOnUse") && input["copyOnUse"].is_boolean()) settings["copyOnUse"] = input["copyOnUse"];
  const std::string sortBy = limitedString(input, "sortBy", 30);
  if (sortBy == "lastUsed" || sortBy == "updated" || sortBy == "title") settings["sortBy"] = sortBy;
  if (input.contains("historyLimit") && input["historyLimit"].is_number_integer()) {
    settings["historyLimit"] = std::clamp(input["historyLimit"].get<int>(), 20, 200);
  }
  persistent_["updatedAt"] = nowIso8601();
  save();
}

void PromptLibraryStore::recordUse(const json& command) {
  const std::string promptId = command.value("promptId", "");
  const std::string renderedText = limitedString(command, "renderedText", 100000);
  if (promptId.empty() || renderedText.empty()) throw std::runtime_error("사용할 프롬프트가 없습니다.");
  auto& prompts = persistent_["prompts"];
  auto found = std::find_if(prompts.begin(), prompts.end(), [&](const json& item) {
    return item.value("id", "") == promptId;
  });
  if (found == prompts.end()) throw std::runtime_error("저장된 프롬프트를 찾을 수 없습니다.");
  const std::string usedAt = nowIso8601();
  (*found)["lastUsedAt"] = usedAt;
  (*found)["usageCount"] = found->value("usageCount", 0) + 1;
  persistent_["updatedAt"] = usedAt;
  save();

  sessionHistory_.insert(sessionHistory_.begin(), json::object({
    {"id", newId()},
    {"promptId", promptId},
    {"title", found->value("title", "")},
    {"renderedText", renderedText},
    {"usedAt", usedAt}
  }));
  const std::size_t limit = static_cast<std::size_t>(
    std::clamp(persistent_["settings"].value("historyLimit", 100), 20, 200));
  while (sessionHistory_.size() > limit) sessionHistory_.erase(sessionHistory_.end() - 1);
}

json PromptLibraryStore::handleCommand(const json& command) {
  const std::string type = command.value("type", "");
  const std::string requestId = command.value("requestId", "");
  if (type == "prompt:getState") return response(requestId);
  if (type == "prompt:save") savePrompt(command);
  else if (type == "prompt:delete") deletePrompt(command);
  else if (type == "prompt:updateSettings") updateSettings(command);
  else if (type == "prompt:use") recordUse(command);
  else if (type == "prompt:clearHistory") sessionHistory_ = json::array();
  else throw std::runtime_error("지원하지 않는 프롬프트 명령입니다.");
  return response(requestId);
}

std::string PromptLibraryStore::nowIso8601() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t time = std::chrono::system_clock::to_time_t(now);
  std::tm utc{};
  gmtime_s(&utc, &time);
  std::ostringstream stream;
  stream << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return stream.str();
}

std::string PromptLibraryStore::newId() {
  GUID guid{};
  if (FAILED(CoCreateGuid(&guid))) throw std::runtime_error("프롬프트 ID를 만들 수 없습니다.");
  wchar_t buffer[40]{};
  StringFromGUID2(guid, buffer, static_cast<int>(std::size(buffer)));
  std::wstring value(buffer);
  if (!value.empty() && value.front() == L'{') value.erase(value.begin());
  if (!value.empty() && value.back() == L'}') value.pop_back();
  return wideToUtf8(value);
}

std::string PromptLibraryStore::wideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) throw std::runtime_error("Windows 문자열을 UTF-8로 변환할 수 없습니다.");
  std::string result(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr);
  return result;
}

void PromptLibraryStore::writeJsonAtomically(const std::filesystem::path& path, const json& value) {
  std::filesystem::create_directories(path.parent_path());
  const std::filesystem::path temporary = path.wstring() + L".tmp";
  {
    std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
    if (!stream) throw std::runtime_error("프롬프트 보관함을 저장할 수 없습니다.");
    stream << value.dump(2);
    stream.flush();
    if (!stream) throw std::runtime_error("프롬프트 보관함 저장 중 오류가 발생했습니다.");
  }
  if (!MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    std::error_code ignored;
    std::filesystem::remove(temporary, ignored);
    throw std::runtime_error("프롬프트 보관함 파일을 교체할 수 없습니다.");
  }
}
