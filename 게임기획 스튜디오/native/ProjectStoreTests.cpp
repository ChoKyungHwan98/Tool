#include "ProjectStore.h"
#include "OpenRouterService.h"
#include "PromptLibraryStore.h"

#include <Windows.h>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {

using json = nlohmann::json;

std::string wideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(
    CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
    nullptr, 0, nullptr, nullptr);
  if (size <= 0) throw std::runtime_error("UTF-8 conversion failed.");
  std::string result(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(
    CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
    result.data(), size, nullptr, nullptr);
  return result;
}

void require(bool condition, const char* message) {
  if (!condition) throw std::runtime_error(message);
}

class TemporaryDirectory {
public:
  TemporaryDirectory() {
    wchar_t buffer[MAX_PATH]{};
    const DWORD length = GetTempPathW(MAX_PATH, buffer);
    if (length == 0 || length >= MAX_PATH) throw std::runtime_error("Temporary path was not found.");
    root_ = std::filesystem::path(buffer) /
      (L"GameDesignStudioTests-" + std::to_wstring(GetCurrentProcessId()));
    std::filesystem::remove_all(root_);
    std::filesystem::create_directories(root_);
  }

  ~TemporaryDirectory() {
    std::error_code ignored;
    std::filesystem::remove_all(root_, ignored);
  }

  const std::filesystem::path& root() const noexcept { return root_; }

private:
  std::filesystem::path root_;
};

} // namespace

int main() {
  const char* phase = "startup";
  try {
    phase = "temporary directory";
    TemporaryDirectory temporary;
    const auto appData = temporary.root() / L"app-data";
    const auto projects = temporary.root() / L"projects";
    const auto tableProjects = temporary.root() / L"table-projects";

    phase = "shared table project repository";
    {
      std::filesystem::create_directories(tableProjects);
      const json firstDocument = {
        {"revision", 1},
        {"schema", {
          {"projectId", "table-project-one"}, {"name", "첫 프로젝트"},
          {"tables", json::array({{{"tableId", "characters"}}})},
          {"relations", json::array()}
        }},
        {"rowsByTable", {{"characters", json::array({{{"rowId", "one"}}})}}}
      };
      std::ofstream(tableProjects / L"first.gsw", std::ios::binary) << firstDocument.dump();
      ProjectStore tableStore(appData / L"table-store", projects / L"table-workspaces", tableProjects);
      auto shared = tableStore.handleCommand({{"type", "tableProject:list"}, {"requestId", "list"}});
      require(shared["records"].size() == 1, "Shared table project was not listed.");
      const json secondDocument = {
        {"revision", 1},
        {"schema", {
          {"projectId", "table-project-two"}, {"name", "둘째 프로젝트"},
          {"tables", json::array()}, {"relations", json::array()}
        }},
        {"rowsByTable", json::object()}
      };
      const auto written = tableStore.handleCommand({
        {"type", "tableProject:write"}, {"requestId", "write"},
        {"projectId", "table-project-two"}, {"name", "둘째 프로젝트"},
        {"serializedDocument", secondDocument.dump()}
      });
      require(written["type"] == "tableProject:written", "Shared table project was not written.");
      shared = tableStore.handleCommand({{"type", "tableProject:list"}, {"requestId", "list-2"}});
      require(shared["records"].size() == 2, "Written table project was not listed.");
      tableStore.handleCommand({
        {"type", "tableProject:trash"}, {"requestId", "trash"}, {"projectId", "table-project-two"}
      });
      shared = tableStore.handleCommand({{"type", "tableProject:list"}, {"requestId", "list-3"}});
      require(shared["records"].size() == 1, "Trashed table project remained in the shared list.");

      const auto emptyChat = tableStore.handleCommand({{"type", "tableChat:load"}, {"requestId", "chat-0"}, {"projectId", "table-project-two"}});
      require(emptyChat["data"].is_null(), "A project without chats returned chat data.");
      tableStore.handleCommand({
        {"type", "tableChat:save"}, {"requestId", "chat-1"}, {"projectId", "table-project-two"},
        {"data", {{"version", 1}, {"conversations", json::array({{{"id", "c1"}, {"title", "몬스터 표"}}})}}}
      });
      const auto savedChat = tableStore.handleCommand({{"type", "tableChat:load"}, {"requestId", "chat-2"}, {"projectId", "table-project-two"}});
      require(savedChat["data"]["conversations"][0]["title"] == "몬스터 표", "Saved table chat was not read back.");
    }

    phase = "AI credential status";
    OpenRouterService openRouter(appData);
    const auto aiStatus = openRouter.handleCommand({
      {"type", "ai:keyStatus"}, {"requestId", "key-status"}, {"monthlyLimit", 10.0}
    });
    require(aiStatus["type"] == "ai:keyStatus", "AI key status response is invalid.");
    require(!aiStatus.contains("key"), "AI key status must never expose the credential.");
    require(aiStatus["budget"]["limit"] == 10.0, "AI monthly budget was not applied.");

    phase = "prompt library persistence boundary";
    {
      PromptLibraryStore prompts(appData);
      auto promptState = prompts.handleCommand({
        {"type", "prompt:save"}, {"requestId", "prompt-save"},
        {"prompt", {
          {"title", "전투 분석"}, {"content", "{{대상}}의 전투 패턴을 분석해줘."},
          {"beginning", "전투 기획자"}, {"ending", "근거를 표시"},
          {"negativePrompt", "근거 없는 수치"}, {"searchOptions", "FSM, ~홍보문"},
          {"removeDuplicateTags", true},
          {"category", "전투"}, {"tags", json::array({"FSM", "분석"})},
          {"target", "ChatGPT"}, {"model", "사용자 선택"}, {"temperature", 0.2},
          {"variableDefaults", {{"대상", "보스"}}}
        }}
      });
      require(promptState["library"]["prompts"].size() == 1, "Prompt was not saved.");
      require(promptState["library"]["prompts"][0]["beginning"] == "전투 기획자", "Prompt composition settings were not saved.");
      const std::string promptId = promptState["library"]["prompts"][0]["id"].get<std::string>();
      promptState = prompts.handleCommand({
        {"type", "prompt:use"}, {"requestId", "prompt-use"},
        {"promptId", promptId}, {"renderedText", "보스의 전투 패턴을 분석해줘."}
      });
      require(promptState["history"].size() == 1, "Prompt session history was not recorded.");
      require(promptState["library"]["prompts"][0]["usageCount"] == 1, "Prompt usage count was not persisted.");
    }
    {
      PromptLibraryStore restoredPrompts(appData);
      const auto promptState = restoredPrompts.handleCommand({
        {"type", "prompt:getState"}, {"requestId", "prompt-restore"}
      });
      require(promptState["library"]["prompts"].size() == 1, "Saved prompt was not restored.");
      require(promptState["library"]["prompts"][0]["usageCount"] == 1, "Prompt usage metadata was not restored.");
      require(promptState["library"]["prompts"][0]["negativePrompt"] == "근거 없는 수치", "Prompt composition settings were not restored.");
      require(promptState["history"].empty(), "Session history must disappear after process-store recreation.");
    }

    std::string projectId;
    const auto projectFile = projects / L"전투 프로젝트" / L"project.gds.json";
    {
      phase = "initial store";
      ProjectStore store(appData, projects);
      auto snapshot = store.snapshot();
      require(snapshot["registry"]["projects"].empty(), "Registry should start empty.");
      require(snapshot["availableTools"].is_array(), "Available tools should be an array.");
      require(snapshot["availableTools"][0].is_object(), "Available tool entries should be objects.");

      phase = "project creation";
      snapshot = store.handleCommand({
        {"type", "project:create"},
        {"name", "전투 프로젝트"},
        {"parentDirectory", wideToUtf8(projects.wstring())}
      });
      require(snapshot["activeProject"]["name"] == "전투 프로젝트", "Project creation failed.");
      require(snapshot["activeProject"]["graph"]["nodes"].empty(), "A new workspace graph should start empty.");
      projectId = snapshot["activeProject"]["id"].get<std::string>();

      phase = "save workspace graph";
      snapshot = store.handleCommand({
        {"type", "workspace:graphSave"},
        {"graph", {
          {"nodes", json::array({
            {{"id", "table-node"}, {"toolId", "table-designer"}, {"x", 120}, {"y", 160}},
            {{"id", "pattern-node"}, {"toolId", "pattern-designer"}, {"x", 500}, {"y", 160}},
            {{"id", "deck-node"}, {"toolId", "deck-designer"}, {"x", 500}, {"y", 360}}
          })},
          {"viewport", {{"x", 10}, {"y", 20}, {"zoom", 0.9}}}
        }},
        {"connections", json::array({
          {{"id", "table-pattern"}, {"from", "table-node"}, {"to", "pattern-node"},
           {"kind", "game-data"}, {"status", "connected"}, {"createdAt", "2026-08-27T00:00:00Z"}}
        })}
      });
      require(snapshot["activeProject"]["graph"]["nodes"].size() == 3, "Workspace nodes were not saved.");
      require(snapshot["activeProject"]["connections"].size() == 1, "Compatible workspace connection was not saved.");
      require(snapshot["activeProject"]["tools"].size() == 3, "Workspace tools were not indexed.");

      phase = "open table";
      snapshot = store.handleCommand({{"type", "tool:activate"}, {"toolId", "table-designer"}});
      phase = "open deck";
      snapshot = store.handleCommand({{"type", "tool:activate"}, {"toolId", "deck-designer"}});
      require(snapshot["activeProject"]["connections"].size() == 1, "Opening a deck must not change graph connections.");

      phase = "open pattern";
      snapshot = store.handleCommand({{"type", "tool:activate"}, {"toolId", "pattern-designer"}});
      require(snapshot["activeProject"]["connections"].size() == 1, "Tools must not connect automatically.");

      phase = "load missing deck artifact";
      auto artifact = store.handleCommand({
        {"type", "artifact:load"},
        {"requestId", "load-1"},
        {"toolId", "deck-designer"},
        {"artifactId", "library"}
      });
      require(!artifact["found"].get<bool>(), "A new deck artifact should not exist.");

      phase = "save deck artifact";
      artifact = store.handleCommand({
        {"type", "artifact:save"},
        {"requestId", "save-1"},
        {"toolId", "deck-designer"},
        {"artifactId", "library"},
        {"expectedRevision", 0},
        {"data", {{"schemaVersion", 1}, {"workspaces", json::array({{{"title", "전투 기획"}}})}}}
      });
      require(artifact["type"] == "artifact:saved", "Deck artifact was not saved.");
      require(artifact["revision"] == 1, "First artifact revision should be one.");

      phase = "detect stale artifact write";
      artifact = store.handleCommand({
        {"type", "artifact:save"},
        {"requestId", "save-stale"},
        {"toolId", "deck-designer"},
        {"artifactId", "library"},
        {"expectedRevision", 0},
        {"data", {{"schemaVersion", 1}, {"workspaces", json::array()}}}
      });
      require(artifact["type"] == "artifact:conflict", "Stale artifact save must conflict.");

      phase = "publish pattern artifact";
      artifact = store.handleCommand({
        {"type", "artifact:publish"},
        {"requestId", "publish-1"},
        {"toolId", "pattern-designer"},
        {"record", {{"artifactId", "boss-pattern"}, {"kind", "pattern-graph"}, {"title", "보스 패턴"}}}
      });
      require(artifact["records"].size() == 1, "Published artifact catalog was not updated.");

      phase = "trash project safely";
      snapshot = store.handleCommand({
        {"type", "project:create"},
        {"name", "삭제 프로젝트"},
        {"parentDirectory", wideToUtf8(projects.wstring())}
      });
      const std::string trashProjectId = snapshot["activeProject"]["id"].get<std::string>();
      snapshot = store.handleCommand({{"type", "project:trash"}, {"projectId", trashProjectId}});
      require(snapshot["registry"]["projects"].size() == 1, "Trashed project remained in registry.");
      require(snapshot["activeProject"].is_null(), "Trashed active project remained open.");
      require(!std::filesystem::exists(projects / L"삭제 프로젝트"), "Trashed project remained at its original path.");
      require(std::filesystem::exists(projects / L".게임기획 스튜디오 휴지통"), "Project trash directory was not created.");
    }

    phase = "prepare legacy workspace migration";
    {
      std::ifstream input(projectFile, std::ios::binary);
      json legacy = json::parse(input);
      legacy["schemaVersion"] = 1;
      legacy["connections"][0]["from"] = "table-designer";
      legacy["connections"][0]["to"] = "pattern-designer";
      legacy["connections"][0]["kind"] = "data-reference";
      std::ofstream output(projectFile, std::ios::binary | std::ios::trunc);
      output << legacy.dump(2);
    }

    {
      phase = "restore store";
      ProjectStore restored(appData, projects);
      const auto snapshot = restored.snapshot();
      require(snapshot["registry"]["lastProjectId"] == projectId, "Last project id was not restored.");
      require(snapshot["activeProject"]["id"] == projectId, "Active project was not restored.");
      require(snapshot["activeProject"]["tools"].size() == 3, "Project tools were not restored.");
      require(snapshot["activeProject"]["connections"].size() == 1, "Workspace connections were not restored.");
      require(snapshot["activeProject"]["connections"][0]["from"] == "table-node", "Legacy source tool id was not migrated to a node id.");
      require(snapshot["activeProject"]["connections"][0]["to"] == "pattern-node", "Legacy target tool id was not migrated to a node id.");
      require(snapshot["activeProject"]["connections"][0]["kind"] == "game-data", "Legacy connection capability was not migrated.");
      require(snapshot["activeProject"]["graph"]["nodes"].size() == 3, "Workspace graph was not restored.");
      phase = "restore deck artifact";
      const auto artifact = restored.handleCommand({
        {"type", "artifact:load"},
        {"requestId", "load-2"},
        {"toolId", "deck-designer"},
        {"artifactId", "library"}
      });
      require(artifact["found"].get<bool>(), "Deck artifact was not restored from disk.");
      require(artifact["data"]["workspaces"].size() == 1, "Restored deck artifact data is wrong.");
    }

    std::cout << "ProjectStore persistence tests passed.\n";
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "ProjectStore persistence tests failed during " << phase << ": " << error.what() << '\n';
    return 1;
  }
}
