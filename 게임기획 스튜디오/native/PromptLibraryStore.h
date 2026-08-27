#pragma once

#include <filesystem>

#include <nlohmann/json.hpp>

class PromptLibraryStore {
public:
  explicit PromptLibraryStore(std::filesystem::path appDataDirectory);

  nlohmann::json handleCommand(const nlohmann::json& command);

private:
  using json = nlohmann::json;

  std::filesystem::path libraryPath_;
  json persistent_;
  json sessionHistory_;

  void load();
  void save() const;
  json response(const std::string& requestId) const;
  void savePrompt(const json& command);
  void deletePrompt(const json& command);
  void updateSettings(const json& command);
  void recordUse(const json& command);

  static json defaultLibrary();
  static json normalizePrompt(const json& prompt, const json* existing);
  static std::string nowIso8601();
  static std::string newId();
  static std::string wideToUtf8(const std::wstring& value);
  static void writeJsonAtomically(const std::filesystem::path& path, const json& value);
};
