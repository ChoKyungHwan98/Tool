#pragma once

#include <filesystem>
#include <optional>
#include <string>

#include <nlohmann/json.hpp>

class ProjectStore {
public:
  ProjectStore();
  ProjectStore(
    std::filesystem::path appDataDirectory,
    std::filesystem::path defaultProjectDirectory,
    std::filesystem::path tableProjectDirectory = {});

  nlohmann::json snapshot() const;
  nlohmann::json handleCommand(const nlohmann::json& command);

  const std::filesystem::path& appDataDirectory() const noexcept;
  const std::filesystem::path& defaultProjectDirectory() const noexcept;

private:
  using json = nlohmann::json;

  std::filesystem::path appDataDirectory_;
  std::filesystem::path defaultProjectDirectory_;
  std::filesystem::path registryPath_;
  std::filesystem::path tableProjectDirectory_;
  json registry_;
  std::optional<json> activeProject_;
  std::filesystem::path activeProjectFile_;

  void loadRegistry();
  void loadLastProject();
  void loadProjectFile(const std::filesystem::path& projectFile);
  void saveRegistry();
  void saveActiveProject();
  void touchActiveProject();

  json createProject(const json& command);
  void activateProject(const std::string& projectId);
  void trashProject(const std::string& projectId);
  void activateTool(const std::string& toolId);
  void saveWorkspaceGraph(const json& command);
  void selectProjectHome();
  void selectTab(const std::string& tabId);
  void closeTab(const std::string& tabId);
  json loadArtifact(const json& command) const;
  json saveArtifact(const json& command);
  json listPublishedArtifacts(const json& command) const;
  json publishArtifact(const json& command);
  json listTableProjects(const json& command) const;
  json writeTableProject(const json& command);
  json trashTableProject(const json& command);
  json loadTableChat(const json& command) const;
  json saveTableChat(const json& command);
  std::filesystem::path tableChatPath(const std::string& projectId) const;
  json tableProjectRecord(const std::filesystem::path& file, const json& document) const;
  std::filesystem::path findTableProject(const std::string& projectId) const;

  std::filesystem::path artifactPath(const std::string& toolId, const std::string& artifactId) const;
  std::filesystem::path artifactCatalogPath() const;
  std::size_t backupCount(const std::filesystem::path& artifactFile) const;
  void createArtifactBackup(const std::filesystem::path& artifactFile, std::int64_t revision) const;
  static void trimArtifactBackups(const std::filesystem::path& historyDirectory, std::size_t keep);

  static json availableTools();
  static json makeHomeTab();
  static json makeToolTab(const std::string& toolId, const json& tool);
  static std::string nowIso8601();
  static std::string newId();
  static std::wstring utf8ToWide(const std::string& value);
  static std::string wideToUtf8(const std::wstring& value);
  static std::wstring safeDirectoryName(const std::wstring& value);
  static std::wstring safeFileName(const std::wstring& value);
  static json readJson(const std::filesystem::path& path);
  static void writeJsonAtomically(const std::filesystem::path& path, const json& value);
};
