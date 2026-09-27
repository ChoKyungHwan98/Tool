#include "ProjectStore.h"

#include <Windows.h>
#include <ShlObj.h>
#include <objbase.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <sstream>
#include <stdexcept>
#include <system_error>
#include <utility>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <cwchar>

namespace {

using json = nlohmann::json;

std::filesystem::path knownFolder(const KNOWNFOLDERID& folderId) {
  PWSTR rawPath = nullptr;
  const HRESULT result = SHGetKnownFolderPath(folderId, KF_FLAG_DEFAULT, nullptr, &rawPath);
  if (FAILED(result) || rawPath == nullptr) {
    throw std::runtime_error("Windows known folder could not be resolved.");
  }

  std::filesystem::path path(rawPath);
  CoTaskMemFree(rawPath);
  return path;
}

bool hasTool(const json& project, const std::string& toolId) {
  const auto& tools = project.value("tools", json::array());
  return std::any_of(tools.begin(), tools.end(), [&](const json& item) {
    return item.value("id", "") == toolId;
  });
}

const json* findToolDefinition(const json& tools, const std::string& toolId) {
  const auto iterator = std::find_if(tools.begin(), tools.end(), [&](const json& item) {
    return item.value("id", "") == toolId;
  });
  return iterator == tools.end() ? nullptr : &(*iterator);
}

bool containsCapability(const json& tool, const char* direction, const std::string& capability) {
  if (!tool.contains("workspace") || !tool["workspace"].is_object()) return false;
  const auto& values = tool["workspace"].value(direction, json::array());
  return values.is_array() && std::any_of(values.begin(), values.end(), [&](const json& item) {
    return item.is_string() && item.get<std::string>() == capability;
  });
}

json defaultGraph() {
  return {
    {"nodes", json::array()},
    {"viewport", {{"x", 0.0}, {"y", 0.0}, {"zoom", 1.0}}}
  };
}

bool migrateLegacyWorkspaceConnections(json& project) {
  if (!project.contains("connections") || !project["connections"].is_array() ||
      !project.contains("graph") || !project["graph"].is_object() ||
      !project["graph"].contains("nodes") || !project["graph"]["nodes"].is_array()) {
    return false;
  }

  std::unordered_set<std::string> nodeIds;
  std::unordered_map<std::string, std::string> uniqueNodeByTool;
  std::unordered_set<std::string> duplicateTools;
  for (const auto& node : project["graph"]["nodes"]) {
    const std::string nodeId = node.value("id", "");
    const std::string toolId = node.value("toolId", "");
    if (!nodeId.empty()) nodeIds.insert(nodeId);
    if (nodeId.empty() || toolId.empty()) continue;
    if (uniqueNodeByTool.contains(toolId)) {
      duplicateTools.insert(toolId);
      uniqueNodeByTool.erase(toolId);
    } else if (!duplicateTools.contains(toolId)) {
      uniqueNodeByTool[toolId] = nodeId;
    }
  }

  bool changed = false;
  for (auto& connection : project["connections"]) {
    if (!connection.is_object()) continue;
    for (const char* endpoint : {"from", "to"}) {
      const std::string value = connection.value(endpoint, "");
      if (!value.empty() && !nodeIds.contains(value) && uniqueNodeByTool.contains(value)) {
        connection[endpoint] = uniqueNodeByTool[value];
        changed = true;
      }
    }
    if (connection.value("kind", "") == "data-reference") {
      connection["kind"] = "game-data";
      changed = true;
    }
  }
  return changed;
}

std::filesystem::path executableDirectory() {
  std::wstring buffer(32768, L'\0');
  const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  if (length == 0 || length >= buffer.size()) {
    throw std::runtime_error("Executable directory could not be resolved.");
  }
  buffer.resize(length);
  return std::filesystem::path(buffer).parent_path();
}

} // namespace

ProjectStore::ProjectStore()
  : ProjectStore(
      knownFolder(FOLDERID_LocalAppData) / L"GameDesignStudio",
      knownFolder(FOLDERID_Documents) / L"GameDesignStudio" / L"Workspaces",
      executableDirectory() / L"도구" / L"테이블 디자이너" / L"프로젝트") {}

ProjectStore::ProjectStore(
    std::filesystem::path appDataDirectory,
    std::filesystem::path defaultProjectDirectory,
    std::filesystem::path tableProjectDirectory)
  : appDataDirectory_(std::move(appDataDirectory)),
    defaultProjectDirectory_(std::move(defaultProjectDirectory)),
    registryPath_(appDataDirectory_ / L"registry.json"),
    tableProjectDirectory_(tableProjectDirectory.empty()
      ? defaultProjectDirectory_.parent_path() / L"TableDesignerProjects"
      : std::move(tableProjectDirectory)) {

  std::filesystem::create_directories(appDataDirectory_);
  std::filesystem::create_directories(defaultProjectDirectory_);
  std::filesystem::create_directories(tableProjectDirectory_);
  loadRegistry();
  loadLastProject();
}

const std::filesystem::path& ProjectStore::appDataDirectory() const noexcept {
  return appDataDirectory_;
}

const std::filesystem::path& ProjectStore::defaultProjectDirectory() const noexcept {
  return defaultProjectDirectory_;
}

json ProjectStore::availableTools() {
  return json::array({
    json::object({
      {"id", "table-designer"},
      {"name", "테이블 디자이너"},
      {"shortName", "테이블"},
      {"description", "게임 데이터와 밸런스 수치를 구조화하고 검증합니다."},
      {"category", "데이터"},
      {"status", "ready"},
      {"accent", "cyan"},
      {"keywords", json::array({"테이블", "밸런스", "스키마", "엑셀", "데이터"})},
      {"workspace", {{"inputs", json::array()}, {"outputs", json::array({"game-data"})}}}
    }),
    json::object({
      {"id", "pattern-designer"},
      {"name", "패턴 디자이너"},
      {"shortName", "패턴"},
      {"description", "FSM·HFSM·BT와 전투 행동 흐름을 설계합니다."},
      {"category", "전투"},
      {"status", "prototype"},
      {"accent", "amber"},
      {"keywords", json::array({"패턴", "전투", "FSM", "HFSM", "BT", "보스"})},
      {"workspace", {{"inputs", json::array({"game-data"})}, {"outputs", json::array()}}}
    }),
    json::object({
      {"id", "review-analytics"},
      {"name", "AI 리뷰데이터 분석"},
      {"shortName", "AI 리뷰데이터 분석"},
      {"description", "Steam 유저 리뷰를 수집·분석하고 기획 인사이트를 만듭니다."},
      {"category", "데이터"},
      {"status", "ready"},
      {"accent", "cyan"},
      {"keywords", json::array({"리뷰", "Steam", "감성", "인사이트", "유저 피드백", "품질", "표본", "AI"})},
      {"workspace", {{"inputs", json::array()}, {"outputs", json::array({"review-insights"})}}}
    }),
    json::object({
      {"id", "deck-designer"},
      {"name", "PPT 디자이너"},
      {"shortName", "PPT 디자이너"},
      {"description", "리뷰 근거와 기획 논리를 PPTX·Word 기획서로 구성합니다."},
      {"category", "문서"},
      {"status", "prototype"},
      {"accent", "violet"},
      {"keywords", json::array({"기획서", "PPT", "PPTX", "Word", "문서"})},
      {"workspace", {{"inputs", json::array({"review-insights"})}, {"outputs", json::array()}}}
    }),
    json::object({
      {"id", "prompt-library"},
      {"name", "프롬프트 빌더"},
      {"shortName", "프롬프트"},
      {"description", "Prombot 방식으로 프롬프트를 조합하고 프리셋을 저장합니다."},
      {"category", "생산성"},
      {"status", "prototype"},
      {"accent", "violet"},
      {"keywords", json::array({"프롬프트", "Prompt", "Prombot", "프리셋", "랜덤", "기록", "AI", "복사"})},
      {"workspace", {{"inputs", json::array()}, {"outputs", json::array()}}}
    })
  });
}

json ProjectStore::makeHomeTab() {
  return {
    {"id", "project-home"},
    {"kind", "project"},
    {"title", "작업공간 홈"},
    {"toolId", "project"},
    {"artifactId", "home"},
    {"pinned", true}
  };
}

json ProjectStore::makeToolTab(const std::string& toolId, const json& tool) {
  return {
    {"id", toolId + ":overview"},
    {"kind", "tool"},
    {"title", tool.value("shortName", tool.value("name", toolId))},
    {"toolId", toolId},
    {"artifactId", "overview"},
    {"pinned", false}
  };
}

void ProjectStore::loadRegistry() {
  registry_ = {
    {"schemaVersion", 1},
    {"lastProjectId", nullptr},
    {"projects", json::array()}
  };

  if (!std::filesystem::exists(registryPath_)) {
    saveRegistry();
    return;
  }

  try {
    json loaded = readJson(registryPath_);
    if (!loaded.is_object() || !loaded.contains("projects") || !loaded["projects"].is_array()) {
      throw std::runtime_error("Invalid project registry shape.");
    }
    registry_ = std::move(loaded);
  } catch (...) {
    const auto backup = registryPath_.wstring() + L".corrupt";
    std::error_code ignored;
    std::filesystem::rename(registryPath_, backup, ignored);
    saveRegistry();
  }
}

void ProjectStore::loadLastProject() {
  if (!registry_.contains("lastProjectId") || registry_["lastProjectId"].is_null()) {
    return;
  }

  const std::string lastId = registry_["lastProjectId"].get<std::string>();
  try {
    activateProject(lastId);
  } catch (...) {
    registry_["lastProjectId"] = nullptr;
    saveRegistry();
  }
}

void ProjectStore::loadProjectFile(const std::filesystem::path& projectFile) {
  json project = readJson(projectFile);
  bool migrated = false;
  if (!project.is_object() || !project.contains("id") || !project.contains("name")) {
    throw std::runtime_error("작업공간 파일 형식이 올바르지 않습니다.");
  }

  if (!project.contains("tools") || !project["tools"].is_array()) {
    project["tools"] = json::array();
  }
  if (!project.contains("connections") || !project["connections"].is_array()) {
    project["connections"] = json::array();
  }
  if (!project.contains("graph") || !project["graph"].is_object()) {
    project["graph"] = defaultGraph();
  }
  if (!project["graph"].contains("nodes") || !project["graph"]["nodes"].is_array()) {
    project["graph"]["nodes"] = json::array();
  }
  if (!project["graph"].contains("viewport") || !project["graph"]["viewport"].is_object()) {
    project["graph"]["viewport"] = defaultGraph()["viewport"];
  }
  std::unordered_set<std::string> graphTools;
  for (const auto& node : project["graph"]["nodes"]) graphTools.insert(node.value("toolId", ""));
  std::size_t migratedIndex = project["graph"]["nodes"].size();
  for (const auto& tool : project["tools"]) {
    const std::string toolId = tool.value("id", "");
    if (toolId.empty() || graphTools.contains(toolId)) continue;
    project["graph"]["nodes"].push_back({
      {"id", toolId + "-node"},
      {"toolId", toolId},
      {"x", 140.0 + static_cast<double>(migratedIndex % 3) * 330.0},
      {"y", 140.0 + static_cast<double>(migratedIndex / 3) * 190.0}
    });
    graphTools.insert(toolId);
    ++migratedIndex;
    migrated = true;
  }
  migrated = migrateLegacyWorkspaceConnections(project) || migrated;
  migrated = project.value("schemaVersion", 0) != 2 || migrated;
  project["schemaVersion"] = 2;
  if (!project.contains("tabs") || !project["tabs"].is_array() || project["tabs"].empty()) {
    project["tabs"] = json::array({makeHomeTab()});
    project["activeTabId"] = "project-home";
    migrated = true;
  }

  activeProject_ = std::move(project);
  activeProjectFile_ = projectFile;
  if (migrated) saveActiveProject();
}

void ProjectStore::saveRegistry() {
  writeJsonAtomically(registryPath_, registry_);
}

void ProjectStore::saveActiveProject() {
  if (!activeProject_.has_value() || activeProjectFile_.empty()) {
    return;
  }
  writeJsonAtomically(activeProjectFile_, *activeProject_);
}

void ProjectStore::touchActiveProject() {
  if (!activeProject_.has_value()) {
    return;
  }

  const std::string updatedAt = nowIso8601();
  (*activeProject_)["updatedAt"] = updatedAt;
  const std::string id = (*activeProject_).value("id", "");
  const std::string name = (*activeProject_).value("name", "");

  for (auto& summary : registry_["projects"]) {
    if (summary.value("id", "") == id) {
      summary["name"] = name;
      summary["updatedAt"] = updatedAt;
      summary["path"] = wideToUtf8(activeProjectFile_.wstring());
      break;
    }
  }
  registry_["lastProjectId"] = id;
  saveActiveProject();
  saveRegistry();
}

json ProjectStore::createProject(const json& command) {
  const std::string name = command.value("name", "");
  if (name.empty()) {
    throw std::runtime_error("작업공간 이름을 입력해 주세요.");
  }

  std::filesystem::path parent = defaultProjectDirectory_;
  const std::string parentText = command.value("parentDirectory", "");
  if (!parentText.empty()) {
    parent = utf8ToWide(parentText);
  }

  std::filesystem::create_directories(parent);
  const std::wstring directoryName = safeDirectoryName(utf8ToWide(name));
  if (directoryName.empty()) {
    throw std::runtime_error("작업공간 이름을 폴더 이름으로 사용할 수 없습니다.");
  }

  const std::filesystem::path projectRoot = parent / directoryName;
  if (std::filesystem::exists(projectRoot)) {
    throw std::runtime_error("같은 위치에 같은 이름의 폴더가 이미 있습니다.");
  }

  std::filesystem::create_directories(projectRoot / L"artifacts");
  std::filesystem::create_directories(projectRoot / L"assets");
  std::filesystem::create_directories(projectRoot / L"exports");

  const std::string id = newId();
  const std::string createdAt = nowIso8601();
  const std::filesystem::path projectFile = projectRoot / L"project.gds.json";
  json project = {
    {"schemaVersion", 2},
    {"id", id},
    {"name", name},
    {"root", wideToUtf8(projectRoot.wstring())},
    {"createdAt", createdAt},
    {"updatedAt", createdAt},
    {"tools", json::array()},
    {"graph", defaultGraph()},
    {"connections", json::array()},
    {"tabs", json::array({makeHomeTab()})},
    {"activeTabId", "project-home"}
  };

  writeJsonAtomically(projectFile, project);
  registry_["projects"].insert(registry_["projects"].begin(), json::object({
    {"id", id},
    {"name", name},
    {"path", wideToUtf8(projectFile.wstring())},
    {"updatedAt", createdAt}
  }));
  registry_["lastProjectId"] = id;
  saveRegistry();
  loadProjectFile(projectFile);
  return project;
}

void ProjectStore::activateProject(const std::string& projectId) {
  const auto& projects = registry_["projects"];
  const auto iterator = std::find_if(projects.begin(), projects.end(), [&](const json& item) {
    return item.value("id", "") == projectId;
  });
  if (iterator == projects.end()) {
    throw std::runtime_error("작업공간을 찾을 수 없습니다.");
  }

  const std::filesystem::path projectFile = utf8ToWide(iterator->value("path", ""));
  if (!std::filesystem::exists(projectFile)) {
    throw std::runtime_error("작업공간 파일이 이동되었거나 삭제되었습니다.");
  }
  loadProjectFile(projectFile);
  registry_["lastProjectId"] = projectId;
  saveRegistry();
}

void ProjectStore::trashProject(const std::string& projectId) {
  auto& projects = registry_["projects"];
  const auto iterator = std::find_if(projects.begin(), projects.end(), [&](const json& item) {
    return item.value("id", "") == projectId;
  });
  if (iterator == projects.end()) throw std::runtime_error("삭제할 작업공간을 찾을 수 없습니다.");

  const std::filesystem::path projectFile = utf8ToWide(iterator->value("path", ""));
  if (projectFile.filename() != L"project.gds.json") throw std::runtime_error("작업공간 경로가 올바르지 않습니다.");
  const std::filesystem::path projectRoot = projectFile.parent_path();
  if (projectRoot.empty() || !std::filesystem::exists(projectRoot)) throw std::runtime_error("작업공간 폴더를 찾을 수 없습니다.");

  const std::filesystem::path trashRoot = projectRoot.parent_path() / L".게임기획 스튜디오 휴지통";
  std::filesystem::create_directories(trashRoot);
  std::wstring trashName = safeDirectoryName(utf8ToWide(iterator->value("name", "프로젝트"))) + L"-" + utf8ToWide(projectId);
  std::filesystem::path destination = trashRoot / trashName;
  if (std::filesystem::exists(destination)) destination += L"-" + utf8ToWide(newId());
  std::filesystem::rename(projectRoot, destination);

  const bool wasActive = activeProject_.has_value() && activeProject_->value("id", "") == projectId;
  projects.erase(iterator);
  if (wasActive) {
    activeProject_.reset();
    activeProjectFile_.clear();
  }
  const std::string lastProjectId = registry_.value("lastProjectId", "");
  if (lastProjectId == projectId) {
    if (projects.empty()) registry_["lastProjectId"] = nullptr;
    else registry_["lastProjectId"] = projects.front().value("id", "");
  }
  saveRegistry();
}

void ProjectStore::activateTool(const std::string& toolId) {
  if (!activeProject_.has_value()) {
    throw std::runtime_error("먼저 작업공간을 열어 주세요.");
  }

  const json definitions = availableTools();
  const json* definition = findToolDefinition(definitions, toolId);
  if (definition == nullptr) {
    throw std::runtime_error("등록되지 않은 도구입니다.");
  }

  if (!hasTool(*activeProject_, toolId)) {
    (*activeProject_)["tools"].push_back(json::object({
      {"id", toolId},
      {"addedAt", nowIso8601()}
    }));
  }

  auto& tabs = (*activeProject_)["tabs"];
  auto reverse = std::find_if(tabs.rbegin(), tabs.rend(), [&](const json& tab) {
    return tab.value("toolId", "") == toolId;
  });

  if (reverse != tabs.rend()) {
    (*activeProject_)["activeTabId"] = reverse->value("id", "");
  } else {
    const json tab = makeToolTab(toolId, *definition);
    tabs.push_back(tab);
    (*activeProject_)["activeTabId"] = tab["id"];
  }

  touchActiveProject();
}

void ProjectStore::saveWorkspaceGraph(const json& command) {
  if (!activeProject_.has_value()) throw std::runtime_error("먼저 작업공간을 열어 주세요.");
  if (!command.contains("graph") || !command["graph"].is_object()) {
    throw std::runtime_error("작업공간 그래프 형식이 올바르지 않습니다.");
  }
  const auto& graph = command["graph"];
  if (!graph.contains("nodes") || !graph["nodes"].is_array() || graph["nodes"].size() > 256) {
    throw std::runtime_error("작업공간 노드 형식이 올바르지 않습니다.");
  }

  const json definitions = availableTools();
  std::unordered_set<std::string> nodeIds;
  std::unordered_map<std::string, const json*> nodeTools;
  json normalizedNodes = json::array();
  for (const auto& node : graph["nodes"]) {
    const std::string id = node.value("id", "");
    const std::string toolId = node.value("toolId", "");
    const json* definition = findToolDefinition(definitions, toolId);
    if (id.empty() || definition == nullptr || !nodeIds.insert(id).second) {
      throw std::runtime_error("등록되지 않았거나 중복된 작업공간 노드입니다.");
    }
    const double x = node.value("x", 0.0);
    const double y = node.value("y", 0.0);
    if (!std::isfinite(x) || !std::isfinite(y)) throw std::runtime_error("노드 위치가 올바르지 않습니다.");
    normalizedNodes.push_back({{"id", id}, {"toolId", toolId}, {"x", x}, {"y", y}});
    nodeTools[id] = definition;
  }

  json normalizedConnections = json::array();
  const auto& connections = command.value("connections", json::array());
  if (!connections.is_array() || connections.size() > 1024) {
    throw std::runtime_error("작업공간 연결 형식이 올바르지 않습니다.");
  }
  std::unordered_set<std::string> connectionIds;
  for (const auto& connection : connections) {
    const std::string id = connection.value("id", "");
    const std::string from = connection.value("from", "");
    const std::string to = connection.value("to", "");
    const std::string kind = connection.value("kind", "");
    if (id.empty() || from == to || !connectionIds.insert(id).second ||
        !nodeTools.contains(from) || !nodeTools.contains(to) ||
        !containsCapability(*nodeTools[from], "outputs", kind) ||
        !containsCapability(*nodeTools[to], "inputs", kind)) {
      throw std::runtime_error("서로 호환되지 않는 도구는 연결할 수 없습니다.");
    }
    normalizedConnections.push_back({
      {"id", id}, {"from", from}, {"to", to}, {"kind", kind},
      {"status", "connected"}, {"createdAt", connection.value("createdAt", nowIso8601())}
    });
  }

  json viewport = graph.value("viewport", defaultGraph()["viewport"]);
  double zoom = viewport.value("zoom", 1.0);
  if (!std::isfinite(zoom)) zoom = 1.0;
  zoom = std::clamp(zoom, 0.35, 2.0);
  double viewportX = viewport.value("x", 0.0);
  double viewportY = viewport.value("y", 0.0);
  if (!std::isfinite(viewportX)) viewportX = 0.0;
  if (!std::isfinite(viewportY)) viewportY = 0.0;
  (*activeProject_)["graph"] = {
    {"nodes", std::move(normalizedNodes)},
    {"viewport", {{"x", viewportX}, {"y", viewportY}, {"zoom", zoom}}}
  };
  (*activeProject_)["connections"] = std::move(normalizedConnections);

  std::unordered_map<std::string, std::string> addedAt;
  for (const auto& tool : (*activeProject_).value("tools", json::array())) {
    addedAt[tool.value("id", "")] = tool.value("addedAt", nowIso8601());
  }
  json projectTools = json::array();
  std::unordered_set<std::string> includedTools;
  for (const auto& node : (*activeProject_)["graph"]["nodes"]) {
    const std::string toolId = node.value("toolId", "");
    if (!includedTools.insert(toolId).second) continue;
    projectTools.push_back({{"id", toolId}, {"addedAt", addedAt.contains(toolId) ? addedAt[toolId] : nowIso8601()}});
  }
  (*activeProject_)["tools"] = std::move(projectTools);

  auto& tabs = (*activeProject_)["tabs"];
  const std::string previousActiveTab = (*activeProject_).value("activeTabId", "project-home");
  tabs.erase(std::remove_if(tabs.begin(), tabs.end(), [&](const json& tab) {
    return tab.value("kind", "") == "tool" && !includedTools.contains(tab.value("toolId", ""));
  }), tabs.end());
  const bool activeTabStillExists = std::any_of(tabs.begin(), tabs.end(), [&](const json& tab) {
    return tab.value("id", "") == previousActiveTab;
  });
  if (!activeTabStillExists) (*activeProject_)["activeTabId"] = "project-home";
  touchActiveProject();
}

void ProjectStore::selectProjectHome() {
  if (!activeProject_.has_value()) {
    return;
  }
  auto& tabs = (*activeProject_)["tabs"];
  const auto found = std::find_if(tabs.begin(), tabs.end(), [](const json& tab) {
    return tab.value("id", "") == "project-home";
  });
  if (found == tabs.end()) {
    tabs.insert(tabs.begin(), makeHomeTab());
  }
  (*activeProject_)["activeTabId"] = "project-home";
  touchActiveProject();
}

void ProjectStore::selectTab(const std::string& tabId) {
  if (!activeProject_.has_value()) {
    return;
  }
  const auto& tabs = (*activeProject_)["tabs"];
  const bool exists = std::any_of(tabs.begin(), tabs.end(), [&](const json& tab) {
    return tab.value("id", "") == tabId;
  });
  if (!exists) {
    throw std::runtime_error("탭을 찾을 수 없습니다.");
  }
  (*activeProject_)["activeTabId"] = tabId;
  touchActiveProject();
}

void ProjectStore::closeTab(const std::string& tabId) {
  if (!activeProject_.has_value() || tabId == "project-home") {
    return;
  }

  auto& tabs = (*activeProject_)["tabs"];
  const auto iterator = std::find_if(tabs.begin(), tabs.end(), [&](const json& tab) {
    return tab.value("id", "") == tabId;
  });
  if (iterator == tabs.end()) {
    return;
  }

  const auto removedIndex = static_cast<std::size_t>(std::distance(tabs.begin(), iterator));
  tabs.erase(iterator);
  if ((*activeProject_).value("activeTabId", "") == tabId) {
    const std::size_t nextIndex = removedIndex == 0 ? 0 : removedIndex - 1;
    (*activeProject_)["activeTabId"] = tabs.at(std::min(nextIndex, tabs.size() - 1)).value("id", "project-home");
  }
  touchActiveProject();
}

std::filesystem::path ProjectStore::artifactPath(
    const std::string& toolId,
    const std::string& artifactId) const {
  if (!activeProject_.has_value() || activeProjectFile_.empty()) {
    throw std::runtime_error("먼저 작업공간을 열어 주세요.");
  }
  if (findToolDefinition(availableTools(), toolId) == nullptr) {
    throw std::runtime_error("등록되지 않은 도구의 자료는 저장할 수 없습니다.");
  }
  const std::wstring safeTool = safeFileName(utf8ToWide(toolId));
  const std::wstring safeArtifact = safeFileName(utf8ToWide(artifactId));
  if (safeArtifact.empty()) {
    throw std::runtime_error("자료 ID가 비어 있습니다.");
  }
  return activeProjectFile_.parent_path() / L"artifacts" / safeTool / (safeArtifact + L".json");
}

std::filesystem::path ProjectStore::artifactCatalogPath() const {
  if (!activeProject_.has_value() || activeProjectFile_.empty()) {
    throw std::runtime_error("먼저 작업공간을 열어 주세요.");
  }
  return activeProjectFile_.parent_path() / L"artifacts" / L"catalog.json";
}

std::size_t ProjectStore::backupCount(const std::filesystem::path& artifactFile) const {
  const auto historyDirectory = artifactFile.parent_path() / L".history" / artifactFile.stem();
  if (!std::filesystem::exists(historyDirectory)) return 0;
  std::size_t count = 0;
  for (const auto& entry : std::filesystem::directory_iterator(historyDirectory)) {
    if (entry.is_regular_file() && entry.path().extension() == L".json") ++count;
  }
  return count;
}

void ProjectStore::createArtifactBackup(
    const std::filesystem::path& artifactFile,
    std::int64_t revision) const {
  if (!std::filesystem::exists(artifactFile)) return;
  const auto historyDirectory = artifactFile.parent_path() / L".history" / artifactFile.stem();
  std::filesystem::create_directories(historyDirectory);
  const auto timestamp = safeFileName(utf8ToWide(nowIso8601()));
  const auto backup = historyDirectory /
    (artifactFile.stem().wstring() + L"-r" + std::to_wstring(revision) + L"-" + timestamp + L".json");
  std::filesystem::copy_file(artifactFile, backup, std::filesystem::copy_options::overwrite_existing);
  trimArtifactBackups(historyDirectory, 20);
}

void ProjectStore::trimArtifactBackups(
    const std::filesystem::path& historyDirectory,
    std::size_t keep) {
  if (!std::filesystem::exists(historyDirectory)) return;
  std::vector<std::filesystem::directory_entry> files;
  for (const auto& entry : std::filesystem::directory_iterator(historyDirectory)) {
    if (entry.is_regular_file() && entry.path().extension() == L".json") files.push_back(entry);
  }
  std::sort(files.begin(), files.end(), [](const auto& left, const auto& right) {
    return left.last_write_time() > right.last_write_time();
  });
  for (std::size_t index = keep; index < files.size(); ++index) {
    std::error_code ignored;
    std::filesystem::remove(files[index].path(), ignored);
  }
}

json ProjectStore::loadArtifact(const json& command) const {
  const std::string requestId = command.value("requestId", "");
  const std::string toolId = command.value("toolId", "");
  const std::string artifactId = command.value("artifactId", "");
  const auto file = artifactPath(toolId, artifactId);
  if (!std::filesystem::exists(file)) {
    return {
      {"type", "artifact:data"},
      {"requestId", requestId},
      {"toolId", toolId},
      {"artifactId", artifactId},
      {"found", false},
      {"revision", 0},
      {"backupCount", 0},
      {"path", wideToUtf8(file.wstring())},
      {"data", nullptr}
    };
  }
  const json envelope = readJson(file);
  return {
    {"type", "artifact:data"},
    {"requestId", requestId},
    {"toolId", toolId},
    {"artifactId", artifactId},
    {"found", true},
    {"revision", envelope.value("revision", 0)},
    {"savedAt", envelope.value("savedAt", "")},
    {"backupCount", backupCount(file)},
    {"path", wideToUtf8(file.wstring())},
    {"data", envelope.contains("data") ? envelope["data"] : json(nullptr)}
  };
}

json ProjectStore::saveArtifact(const json& command) {
  const std::string requestId = command.value("requestId", "");
  const std::string toolId = command.value("toolId", "");
  const std::string artifactId = command.value("artifactId", "");
  const auto file = artifactPath(toolId, artifactId);
  const bool exists = std::filesystem::exists(file);
  const json current = exists ? readJson(file) : json::object();
  const std::int64_t currentRevision = current.value("revision", 0LL);
  const std::int64_t expectedRevision = command.value("expectedRevision", currentRevision);
  const bool force = command.value("force", false);
  if (!force && expectedRevision != currentRevision) {
    return {
      {"type", "artifact:conflict"},
      {"requestId", requestId},
      {"toolId", toolId},
      {"artifactId", artifactId},
      {"expectedRevision", expectedRevision},
      {"actualRevision", currentRevision},
      {"savedAt", current.value("savedAt", "")},
      {"data", current.contains("data") ? current["data"] : json(nullptr)}
    };
  }
  if (exists) createArtifactBackup(file, currentRevision);
  const std::int64_t nextRevision = currentRevision + 1;
  const std::string savedAt = nowIso8601();
  const json envelope = {
    {"schemaVersion", 1},
    {"toolId", toolId},
    {"artifactId", artifactId},
    {"revision", nextRevision},
    {"savedAt", savedAt},
    {"data", command.contains("data") ? command["data"] : json(nullptr)}
  };
  writeJsonAtomically(file, envelope);
  touchActiveProject();
  return {
    {"type", "artifact:saved"},
    {"requestId", requestId},
    {"toolId", toolId},
    {"artifactId", artifactId},
    {"revision", nextRevision},
    {"savedAt", savedAt},
    {"backupCount", backupCount(file)},
    {"path", wideToUtf8(file.wstring())}
  };
}

json ProjectStore::listPublishedArtifacts(const json& command) const {
  const auto file = artifactCatalogPath();
  json records = json::array();
  if (std::filesystem::exists(file)) {
    const json catalog = readJson(file);
    if (catalog.contains("records") && catalog["records"].is_array()) records = catalog["records"];
  }
  return {
    {"type", "artifact:catalog"},
    {"requestId", command.value("requestId", "")},
    {"records", records}
  };
}

json ProjectStore::publishArtifact(const json& command) {
  const std::string requestId = command.value("requestId", "");
  const std::string toolId = command.value("toolId", "");
  if (findToolDefinition(availableTools(), toolId) == nullptr) {
    throw std::runtime_error("등록되지 않은 도구의 자료는 게시할 수 없습니다.");
  }
  if (!command.contains("record") || !command["record"].is_object()) {
    throw std::runtime_error("게시할 자료 정보가 없습니다.");
  }
  json record = command["record"];
  const std::string artifactId = record.value("artifactId", "");
  if (artifactId.empty()) throw std::runtime_error("게시 자료 ID가 비어 있습니다.");
  record["toolId"] = toolId;
  record["catalogId"] = toolId + ":" + artifactId;
  record["publishedAt"] = nowIso8601();

  const auto file = artifactCatalogPath();
  json catalog = {{"schemaVersion", 1}, {"records", json::array()}};
  if (std::filesystem::exists(file)) {
    const json loaded = readJson(file);
    if (loaded.is_object() && loaded.contains("records") && loaded["records"].is_array()) {
      catalog = loaded;
    }
  }
  auto& records = catalog["records"];
  const auto found = std::find_if(records.begin(), records.end(), [&](const json& item) {
    return item.value("catalogId", "") == record.value("catalogId", "");
  });
  if (found == records.end()) records.push_back(record);
  else *found = record;
  catalog["updatedAt"] = nowIso8601();
  writeJsonAtomically(file, catalog);
  touchActiveProject();
  return {
    {"type", "artifact:catalog"},
    {"requestId", requestId},
    {"records", records}
  };
}

json ProjectStore::snapshot() const {
  json result = {
    {"type", "state:snapshot"},
    {"version", GDS_VERSION},
    {"defaultProjectDirectory", wideToUtf8(defaultProjectDirectory_.wstring())},
    {"registry", registry_},
    {"availableTools", availableTools()}
  };
  result["activeProject"] = activeProject_.has_value() ? *activeProject_ : json(nullptr);
  return result;
}

json ProjectStore::handleCommand(const json& command) {
  const std::string type = command.value("type", "");
  if (type == "app:getState") {
    return snapshot();
  }
  if (type == "project:create") {
    createProject(command);
  } else if (type == "project:activate") {
    activateProject(command.value("projectId", ""));
  } else if (type == "project:trash") {
    trashProject(command.value("projectId", ""));
  } else if (type == "tool:activate") {
    activateTool(command.value("toolId", ""));
  } else if (type == "workspace:graphSave") {
    saveWorkspaceGraph(command);
  } else if (type == "project:home") {
    selectProjectHome();
  } else if (type == "tab:select") {
    selectTab(command.value("tabId", ""));
  } else if (type == "tab:close") {
    closeTab(command.value("tabId", ""));
  } else if (type == "artifact:load") {
    return loadArtifact(command);
  } else if (type == "artifact:save") {
    return saveArtifact(command);
  } else if (type == "artifact:list") {
    return listPublishedArtifacts(command);
  } else if (type == "artifact:publish") {
    return publishArtifact(command);
  } else if (type == "tableProject:list") {
    return listTableProjects(command);
  } else if (type == "tableProject:write") {
    return writeTableProject(command);
  } else if (type == "tableProject:trash") {
    return trashTableProject(command);
  } else if (type == "tableChat:load") {
    return loadTableChat(command);
  } else if (type == "tableChat:save") {
    return saveTableChat(command);
  } else {
    throw std::runtime_error("지원하지 않는 명령입니다: " + type);
  }
  return snapshot();
}

json ProjectStore::tableProjectRecord(const std::filesystem::path& file, const json& document) const {
  if (!document.contains("schema") || !document["schema"].is_object()) {
    throw std::runtime_error("테이블 프로젝트에 schema가 없습니다.");
  }
  const auto& schema = document["schema"];
  const std::string projectId = schema.value("projectId", "");
  if (projectId.empty()) throw std::runtime_error("테이블 프로젝트 ID가 없습니다.");
  std::size_t rowCount = 0;
  if (document.contains("rowsByTable") && document["rowsByTable"].is_object()) {
    for (const auto& [_, rows] : document["rowsByTable"].items()) {
      if (rows.is_array()) rowCount += rows.size();
    }
  }
  const auto tables = schema.value("tables", json::array());
  const auto relations = schema.value("relations", json::array());
  return {
    {"id", projectId},
    {"name", schema.value("name", file.stem().string())},
    {"tableCount", tables.is_array() ? tables.size() : 0},
    {"relationCount", relations.is_array() ? relations.size() : 0},
    {"rowCount", rowCount},
    {"updatedAt", nowIso8601()},
    {"location", wideToUtf8(file.wstring())},
    {"recoveryCount", 0},
    {"recovered", false},
    {"checksum", ""},
    {"serializedDocument", document.dump()},
    {"linkedFile", {
      {"path", wideToUtf8(file.wstring())},
      {"lastKnownModifiedAt", nowIso8601()},
      {"checksum", ""}
    }}
  };
}

std::filesystem::path ProjectStore::findTableProject(const std::string& projectId) const {
  if (!std::filesystem::exists(tableProjectDirectory_)) return {};
  for (const auto& entry : std::filesystem::directory_iterator(tableProjectDirectory_)) {
    if (!entry.is_regular_file() || entry.path().extension() != L".gsw") continue;
    try {
      const auto document = readJson(entry.path());
      if (document.contains("schema") && document["schema"].value("projectId", "") == projectId) {
        return entry.path();
      }
    } catch (...) {
      // A broken file is ignored here and remains available for manual recovery.
    }
  }
  return {};
}

json ProjectStore::listTableProjects(const json& command) const {
  json records = json::array();
  if (std::filesystem::exists(tableProjectDirectory_)) {
    for (const auto& entry : std::filesystem::directory_iterator(tableProjectDirectory_)) {
      if (!entry.is_regular_file() || entry.path().extension() != L".gsw") continue;
      try {
        records.push_back(tableProjectRecord(entry.path(), readJson(entry.path())));
      } catch (...) {
        // Keep listing the remaining valid project files.
      }
    }
  }
  std::sort(records.begin(), records.end(), [](const json& left, const json& right) {
    return left.value("name", "") < right.value("name", "");
  });
  return {{"type", "tableProject:records"}, {"requestId", command.value("requestId", "")}, {"records", records}};
}

json ProjectStore::writeTableProject(const json& command) {
  const std::string serialized = command.value("serializedDocument", "");
  const json document = json::parse(serialized);
  const std::string projectId = command.value("projectId", document["schema"].value("projectId", ""));
  const std::string name = command.value("name", document["schema"].value("name", "프로젝트"));
  if (projectId.empty()) throw std::runtime_error("저장할 테이블 프로젝트 ID가 없습니다.");
  std::filesystem::create_directories(tableProjectDirectory_);
  auto file = findTableProject(projectId);
  if (file.empty()) file = tableProjectDirectory_ / (safeFileName(utf8ToWide(name)) + L".gsw");
  writeJsonAtomically(file, document);
  return {
    {"type", "tableProject:written"},
    {"requestId", command.value("requestId", "")},
    {"record", tableProjectRecord(file, document)}
  };
}

json ProjectStore::trashTableProject(const json& command) {
  const std::string projectId = command.value("projectId", "");
  const auto source = findTableProject(projectId);
  if (!source.empty()) {
    const auto trash = tableProjectDirectory_ / L".table-designer" / L"trash";
    std::filesystem::create_directories(trash);
    auto target = trash / source.filename();
    if (std::filesystem::exists(target)) {
      target = trash / (safeFileName(source.stem().wstring() + L"-" + utf8ToWide(nowIso8601())) + L".gsw");
    }
    std::filesystem::rename(source, target);
  }
  return {{"type", "tableProject:trashed"}, {"requestId", command.value("requestId", "")}, {"projectId", projectId}};
}

// 테이블 디자이너 AI 대화는 표 파일(.gsw)과 분리해 프로젝트 폴더 안 숨김 폴더에 둔다.
// .gsw를 다른 사람에게 넘겨도 대화가 따라가지 않게 하기 위해서다.
std::filesystem::path ProjectStore::tableChatPath(const std::string& projectId) const {
  const std::wstring safeId = safeFileName(utf8ToWide(projectId));
  if (safeId.empty()) throw std::runtime_error("대화를 저장할 프로젝트 ID가 없습니다.");
  return tableProjectDirectory_ / L".table-designer" / L"chats" / (safeId + L".json");
}

json ProjectStore::loadTableChat(const json& command) const {
  const auto file = tableChatPath(command.value("projectId", ""));
  json data = nullptr;
  if (std::filesystem::exists(file)) {
    try {
      data = readJson(file);
    } catch (...) {
      data = nullptr;  // 깨진 파일은 무시하고 빈 대화로 시작한다. 파일은 수동 복구용으로 남긴다.
    }
  }
  return {{"type", "tableChat:data"}, {"requestId", command.value("requestId", "")}, {"data", data}};
}

json ProjectStore::saveTableChat(const json& command) {
  const auto file = tableChatPath(command.value("projectId", ""));
  std::filesystem::create_directories(file.parent_path());
  writeJsonAtomically(file, command.value("data", json::object()));
  return {{"type", "tableChat:saved"}, {"requestId", command.value("requestId", "")}};
}

std::string ProjectStore::nowIso8601() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t time = std::chrono::system_clock::to_time_t(now);
  std::tm utc{};
  gmtime_s(&utc, &time);
  std::ostringstream stream;
  stream << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return stream.str();
}

std::string ProjectStore::newId() {
  GUID guid{};
  if (FAILED(CoCreateGuid(&guid))) {
    throw std::runtime_error("작업공간 ID를 만들 수 없습니다.");
  }
  wchar_t buffer[40]{};
  StringFromGUID2(guid, buffer, static_cast<int>(std::size(buffer)));
  std::wstring value(buffer);
  if (!value.empty() && value.front() == L'{') value.erase(value.begin());
  if (!value.empty() && value.back() == L'}') value.pop_back();
  return wideToUtf8(value);
}

std::wstring ProjectStore::utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) throw std::runtime_error("UTF-8 문자열을 변환할 수 없습니다.");
  std::wstring result(static_cast<std::size_t>(size), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size);
  return result;
}

std::string ProjectStore::wideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) throw std::runtime_error("Windows 문자열을 UTF-8로 변환할 수 없습니다.");
  std::string result(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr);
  return result;
}

std::wstring ProjectStore::safeDirectoryName(const std::wstring& value) {
  std::wstring result = value;
  constexpr wchar_t invalid[] = L"<>:\"/\\|?*";
  for (wchar_t& character : result) {
    if (character < 32 || std::wcschr(invalid, character) != nullptr) {
      character = L'_';
    }
  }
  while (!result.empty() && (result.back() == L' ' || result.back() == L'.')) {
    result.pop_back();
  }
  return result;
}

std::wstring ProjectStore::safeFileName(const std::wstring& value) {
  std::wstring result;
  result.reserve(value.size());
  for (const wchar_t character : value) {
    const bool allowed =
      (character >= L'a' && character <= L'z') ||
      (character >= L'A' && character <= L'Z') ||
      (character >= L'0' && character <= L'9') ||
      character == L'-' || character == L'_' || character == L'.';
    result.push_back(allowed ? character : L'_');
  }
  while (!result.empty() && (result.back() == L'.' || result.back() == L' ')) result.pop_back();
  return result;
}

json ProjectStore::readJson(const std::filesystem::path& path) {
  std::ifstream stream(path, std::ios::binary);
  if (!stream) {
    throw std::runtime_error("파일을 열 수 없습니다: " + wideToUtf8(path.wstring()));
  }
  json value;
  stream >> value;
  return value;
}

void ProjectStore::writeJsonAtomically(const std::filesystem::path& path, const json& value) {
  std::filesystem::create_directories(path.parent_path());
  const std::filesystem::path temporary = path.wstring() + L".tmp";
  {
    std::ofstream stream(temporary, std::ios::binary | std::ios::trunc);
    if (!stream) {
      throw std::runtime_error("파일을 저장할 수 없습니다: " + wideToUtf8(path.wstring()));
    }
    stream << value.dump(2);
    stream.flush();
    if (!stream) {
      throw std::runtime_error("파일 저장 중 오류가 발생했습니다.");
    }
  }

  if (!MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) {
    std::error_code ignored;
    std::filesystem::remove(temporary, ignored);
    throw std::runtime_error("저장 파일을 교체할 수 없습니다.");
  }
}
