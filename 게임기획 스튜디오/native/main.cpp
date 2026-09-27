#include <Windows.h>
#include <windowsx.h>
#include <CommCtrl.h>
#include <ShObjIdl.h>
#include <dwmapi.h>
#include <shellapi.h>
#include <wrl.h>

#include <WebView2.h>
#include <nlohmann/json.hpp>

#include <filesystem>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "ProjectStore.h"
#include "OpenRouterService.h"
#include "PromptLibraryStore.h"
#include "DownloadHistory.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
using json = nlohmann::json;

namespace {

constexpr wchar_t kWindowClass[] = L"GameDesignStudioWindow";
constexpr wchar_t kWindowTitle[] = L"도구 보관함";
constexpr wchar_t kSingleInstanceMutex[] = L"Local\\GameDesignStudio.SingleInstance";
constexpr UINT kTrayMessage = WM_APP + 17;
constexpr UINT kAsyncJsonMessage = WM_APP + 18;
constexpr UINT kRestartReviewServerMessage = WM_APP + 19;
constexpr UINT kTrayOpen = 41001;
constexpr UINT kTrayQuit = 41002;

HWND g_window = nullptr;
NOTIFYICONDATAW g_trayIcon{};
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webView;
std::unique_ptr<ProjectStore> g_store;
std::shared_ptr<OpenRouterService> g_openRouter;
std::unique_ptr<PromptLibraryStore> g_promptLibrary;
std::unique_ptr<DownloadHistory> g_downloads;
HANDLE g_reviewAnalyticsProcess = nullptr;
HANDLE g_pptDesignerProcess = nullptr;
bool g_allowExit = false;
bool g_closeNoticeShown = false;

std::wstring utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (size <= 0) throw std::runtime_error("UTF-8 conversion failed.");
  std::wstring result(static_cast<std::size_t>(size), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size);
  return result;
}

std::string wideToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) throw std::runtime_error("Windows string conversion failed.");
  std::string result(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), result.data(), size, nullptr, nullptr);
  return result;
}

std::filesystem::path executableDirectory() {
  std::wstring buffer(32768, L'\0');
  const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  if (length == 0 || length >= buffer.size()) {
    throw std::runtime_error("Executable path could not be resolved.");
  }
  buffer.resize(length);
  return std::filesystem::path(buffer).parent_path();
}

std::filesystem::path reviewAnalyticsProgramDirectory() {
  const auto executable = executableDirectory();
  const std::vector<std::filesystem::path> candidates = {
    executable / L"도구" / L"AI 리뷰데이터 분석" / L"프로그램",
    executable.parent_path().parent_path().parent_path() /
      L"도구" / L"AI 리뷰데이터 분석" / L"프로그램",
    std::filesystem::current_path() / L"도구" / L"AI 리뷰데이터 분석" / L"프로그램",
  };
  for (const auto& candidate : candidates) {
    if (std::filesystem::exists(candidate / L"main.py")) return candidate;
  }
  return {};
}

void startReviewAnalyticsServer() {
  const auto programDirectory = reviewAnalyticsProgramDirectory();
  if (programDirectory.empty()) return;

  const auto bundledPython = programDirectory / L"venv" / L"Scripts" / L"python.exe";
  const std::wstring python = std::filesystem::exists(bundledPython)
    ? bundledPython.wstring()
    : L"python.exe";
  const std::wstring commandLine =
    L"\"" + python + L"\" -m uvicorn main:app --host 127.0.0.1 --port 8765";
  std::vector<wchar_t> mutableCommand(commandLine.begin(), commandLine.end());
  mutableCommand.push_back(L'\0');

  // The key never touches the review tool's files.  It is read from Windows
  // Credential Manager only while starting this local child process.
  std::vector<wchar_t> previousKey;
  const DWORD previousKeyLength = GetEnvironmentVariableW(L"OPENROUTER_API_KEY", nullptr, 0);
  const bool hadPreviousKey = previousKeyLength > 0;
  if (hadPreviousKey) {
    previousKey.resize(previousKeyLength);
    GetEnvironmentVariableW(L"OPENROUTER_API_KEY", previousKey.data(), previousKeyLength);
  }
  std::string storedKey;
  if (g_openRouter) storedKey = OpenRouterService::readApiKey();
  if (!storedKey.empty()) SetEnvironmentVariableW(L"OPENROUTER_API_KEY", utf8ToWide(storedKey).c_str());

  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  const bool created = CreateProcessW(
      nullptr,
      mutableCommand.data(),
      nullptr,
      nullptr,
      FALSE,
      CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT,
      nullptr,
      programDirectory.c_str(),
      &startup,
      &process) != FALSE;

  if (hadPreviousKey) SetEnvironmentVariableW(L"OPENROUTER_API_KEY", previousKey.data());
  else SetEnvironmentVariableW(L"OPENROUTER_API_KEY", nullptr);
  if (!created) return;

  CloseHandle(process.hThread);
  g_reviewAnalyticsProcess = process.hProcess;
}

void stopReviewAnalyticsServer() {
  if (!g_reviewAnalyticsProcess) return;
  if (WaitForSingleObject(g_reviewAnalyticsProcess, 0) == WAIT_TIMEOUT) {
    TerminateProcess(g_reviewAnalyticsProcess, 0);
    WaitForSingleObject(g_reviewAnalyticsProcess, 1000);
  }
  CloseHandle(g_reviewAnalyticsProcess);
  g_reviewAnalyticsProcess = nullptr;
}

std::filesystem::path pptDesignerDirectory() {
  const auto executable = executableDirectory();
  const std::vector<std::filesystem::path> candidates = {
    executable / L"도구" / L"PPT 디자이너" / L"game-ppt-designer-next",
    executable.parent_path().parent_path().parent_path() / L"도구" / L"PPT 디자이너" / L"game-ppt-designer-next",
    std::filesystem::current_path() / L"도구" / L"PPT 디자이너" / L"game-ppt-designer-next",
  };
  for (const auto& candidate : candidates) {
    if (std::filesystem::exists(candidate / L"packages" / L"studio-integration" / L"src" / L"server.ts")) return candidate;
  }
  return {};
}

void startPptDesignerServer() {
  const auto programDirectory = pptDesignerDirectory();
  if (programDirectory.empty()) return;
  const auto tsx = programDirectory / L"node_modules" / L"tsx" / L"dist" / L"cli.mjs";
  const auto server = programDirectory / L"packages" / L"studio-integration" / L"src" / L"server.ts";
  if (!std::filesystem::exists(tsx)) return;
  const std::wstring commandLine = L"node.exe \"" + tsx.wstring() + L"\" \"" + server.wstring() + L"\"";
  std::vector<wchar_t> mutableCommand(commandLine.begin(), commandLine.end());
  mutableCommand.push_back(L'\0');

  std::vector<wchar_t> previousKey;
  const DWORD previousKeyLength = GetEnvironmentVariableW(L"OPENROUTER_API_KEY", nullptr, 0);
  const bool hadPreviousKey = previousKeyLength > 0;
  if (hadPreviousKey) { previousKey.resize(previousKeyLength); GetEnvironmentVariableW(L"OPENROUTER_API_KEY", previousKey.data(), previousKeyLength); }
  const std::string storedKey = g_openRouter ? OpenRouterService::readApiKey() : std::string();
  if (!storedKey.empty()) SetEnvironmentVariableW(L"OPENROUTER_API_KEY", utf8ToWide(storedKey).c_str());

  STARTUPINFOW startup{}; startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  const bool created = CreateProcessW(nullptr, mutableCommand.data(), nullptr, nullptr, FALSE,
    CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT, nullptr, programDirectory.c_str(), &startup, &process) != FALSE;
  if (hadPreviousKey) SetEnvironmentVariableW(L"OPENROUTER_API_KEY", previousKey.data());
  else SetEnvironmentVariableW(L"OPENROUTER_API_KEY", nullptr);
  if (!created) return;
  CloseHandle(process.hThread);
  g_pptDesignerProcess = process.hProcess;
}

void stopPptDesignerServer() {
  if (!g_pptDesignerProcess) return;
  if (WaitForSingleObject(g_pptDesignerProcess, 0) == WAIT_TIMEOUT) {
    TerminateProcess(g_pptDesignerProcess, 0);
    WaitForSingleObject(g_pptDesignerProcess, 1000);
  }
  CloseHandle(g_pptDesignerProcess);
  g_pptDesignerProcess = nullptr;
}

std::filesystem::path resolveUiDirectory() {
  const auto packaged = executableDirectory() / L"assets" / L"ui";
  if (std::filesystem::exists(packaged / L"index.html")) {
    return packaged;
  }

  const auto topLevelPackage = executableDirectory() /
    L"게임기획 스튜디오" / L"app" / L"assets" / L"ui";
  if (std::filesystem::exists(topLevelPackage / L"index.html")) {
    return topLevelPackage;
  }

  const std::filesystem::path source(GDS_UI_SOURCE_DIR);
  if (std::filesystem::exists(source / L"index.html")) {
    return source;
  }

  throw std::runtime_error("UI assets were not found. Run scripts/build.ps1 first.");
}

void postJson(const json& payload) {
  if (!g_webView) return;
  const std::wstring text = utf8ToWide(payload.dump());
  g_webView->PostWebMessageAsJson(text.c_str());
}

void postError(const std::string& message) {
  postJson({{"type", "app:error"}, {"message", message}});
}

void showMainWindow() {
  if (!g_window) return;
  ShowWindow(g_window, SW_SHOW);
  if (IsIconic(g_window)) ShowWindow(g_window, SW_RESTORE);
  SetForegroundWindow(g_window);
}

void hideMainWindow() {
  if (!g_window) return;
  ShowWindow(g_window, SW_HIDE);
  if (!g_closeNoticeShown) {
    g_closeNoticeShown = true;
    g_trayIcon.uFlags |= NIF_INFO;
    wcscpy_s(g_trayIcon.szInfoTitle, L"도구 보관함");
    wcscpy_s(g_trayIcon.szInfo, L"프로그램은 트레이에서 계속 실행됩니다.");
    g_trayIcon.dwInfoFlags = NIIF_INFO;
    Shell_NotifyIconW(NIM_MODIFY, &g_trayIcon);
    g_trayIcon.uFlags &= ~NIF_INFO;
  }
}

void quitApplication() {
  g_allowExit = true;
  if (g_window) DestroyWindow(g_window);
}

void addTrayIcon() {
  g_trayIcon = {};
  g_trayIcon.cbSize = sizeof(g_trayIcon);
  g_trayIcon.hWnd = g_window;
  g_trayIcon.uID = 1;
  g_trayIcon.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
  g_trayIcon.uCallbackMessage = kTrayMessage;
  g_trayIcon.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
  wcscpy_s(g_trayIcon.szTip, kWindowTitle);
  Shell_NotifyIconW(NIM_ADD, &g_trayIcon);
  g_trayIcon.uVersion = NOTIFYICON_VERSION_4;
  Shell_NotifyIconW(NIM_SETVERSION, &g_trayIcon);
}

void removeTrayIcon() {
  if (g_trayIcon.hWnd) {
    Shell_NotifyIconW(NIM_DELETE, &g_trayIcon);
    g_trayIcon.hWnd = nullptr;
  }
}

void showTrayMenu() {
  POINT point{};
  GetCursorPos(&point);
  HMENU menu = CreatePopupMenu();
  AppendMenuW(menu, MF_STRING | MF_DEFAULT, kTrayOpen, L"도구 보관함 열기");
  AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
  AppendMenuW(menu, MF_STRING, kTrayQuit, L"완전 종료");
  SetForegroundWindow(g_window);
  TrackPopupMenu(menu, TPM_RIGHTBUTTON | TPM_BOTTOMALIGN | TPM_LEFTALIGN, point.x, point.y, 0, g_window, nullptr);
  DestroyMenu(menu);
}

std::optional<std::filesystem::path> chooseFolder() {
  ComPtr<IFileOpenDialog> dialog;
  HRESULT result = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog));
  if (FAILED(result)) return std::nullopt;

  FILEOPENDIALOGOPTIONS options{};
  dialog->GetOptions(&options);
  dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
  dialog->SetTitle(L"프로젝트를 저장할 폴더 선택");
  if (FAILED(dialog->Show(g_window))) return std::nullopt;

  ComPtr<IShellItem> item;
  if (FAILED(dialog->GetResult(&item))) return std::nullopt;
  PWSTR rawPath = nullptr;
  if (FAILED(item->GetDisplayName(SIGDN_FILESYSPATH, &rawPath)) || rawPath == nullptr) return std::nullopt;
  std::filesystem::path path(rawPath);
  CoTaskMemFree(rawPath);
  return path;
}

void handleWebMessage(ICoreWebView2WebMessageReceivedEventArgs* args) {
  LPWSTR rawMessage = nullptr;
  if (FAILED(args->get_WebMessageAsJson(&rawMessage)) || rawMessage == nullptr) {
    postError("화면 메시지를 읽지 못했습니다.");
    return;
  }

  try {
    const std::string text = wideToUtf8(rawMessage);
    CoTaskMemFree(rawMessage);
    rawMessage = nullptr;
    const json command = json::parse(text);
    const std::string type = command.value("type", "");

    if (type == "dialog:chooseFolder") {
      const auto selected = chooseFolder();
      if (selected.has_value()) {
        postJson({{"type", "dialog:folderSelected"}, {"path", wideToUtf8(selected->wstring())}});
      }
      return;
    }
    if (type == "window:hide") {
      hideMainWindow();
      return;
    }
    if (type == "window:startDrag") {
      ReleaseCapture();
      SendMessageW(g_window, WM_NCLBUTTONDOWN, HTCAPTION, 0);
      return;
    }
    if (type == "window:minimize") {
      ShowWindow(g_window, SW_MINIMIZE);
      return;
    }
    if (type == "window:toggleMaximize") {
      ShowWindow(g_window, IsZoomed(g_window) ? SW_RESTORE : SW_MAXIMIZE);
      return;
    }
    if (type == "app:quit") {
      quitApplication();
      return;
    }

    if (type.rfind("ai:", 0) == 0) {
      const auto service = g_openRouter;
      std::thread([service, command]() {
        json response;
        try {
          response = service->handleCommand(command);
        } catch (const std::exception& error) {
          response = {{"type", "ai:error"}, {"requestId", command.value("requestId", "")}, {"message", error.what()}};
        }
        auto* payload = new json(std::move(response));
        if (!PostMessageW(g_window, kAsyncJsonMessage, 0, reinterpret_cast<LPARAM>(payload))) delete payload;
        if (command.value("type", "") == "ai:keySave" || command.value("type", "") == "ai:keyDelete") {
          PostMessageW(g_window, kRestartReviewServerMessage, 0, 0);
        }
      }).detach();
      return;
    }

    if (type.rfind("downloads:", 0) == 0) {
      postJson(g_downloads->handleCommand(command));
      return;
    }

    if (type.rfind("prompt:", 0) == 0) {
      postJson(g_promptLibrary->handleCommand(command));
      return;
    }

    postJson(g_store->handleCommand(command));
  } catch (const std::exception& error) {
    if (rawMessage != nullptr) CoTaskMemFree(rawMessage);
    postError(error.what());
  }
}

void resizeWebView() {
  if (!g_controller || !g_window) return;
  RECT bounds{};
  GetClientRect(g_window, &bounds);
  g_controller->put_Bounds(bounds);
}

LRESULT resizeBorderHitTest(HWND window, LPARAM lParam) {
  if (IsZoomed(window)) return HTCLIENT;

  RECT windowRect{};
  GetWindowRect(window, &windowRect);
  const UINT dpi = GetDpiForWindow(window);
  const int horizontalBorder = GetSystemMetricsForDpi(SM_CXSIZEFRAME, dpi)
    + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
  const int verticalBorder = GetSystemMetricsForDpi(SM_CYSIZEFRAME, dpi)
    + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
  const POINT pointer{GET_X_LPARAM(lParam), GET_Y_LPARAM(lParam)};

  const bool left = pointer.x >= windowRect.left && pointer.x < windowRect.left + horizontalBorder;
  const bool right = pointer.x < windowRect.right && pointer.x >= windowRect.right - horizontalBorder;
  const bool top = pointer.y >= windowRect.top && pointer.y < windowRect.top + verticalBorder;
  const bool bottom = pointer.y < windowRect.bottom && pointer.y >= windowRect.bottom - verticalBorder;

  if (top && left) return HTTOPLEFT;
  if (top && right) return HTTOPRIGHT;
  if (bottom && left) return HTBOTTOMLEFT;
  if (bottom && right) return HTBOTTOMRIGHT;
  if (left) return HTLEFT;
  if (right) return HTRIGHT;
  if (top) return HTTOP;
  if (bottom) return HTBOTTOM;
  return HTCLIENT;
}

// ── WebView2 런타임 확인 ────────────────────────────────────────
// 화면은 WebView2로 그린다. Windows 11과 업데이트된 Windows 10에는 이미 있지만, 없는 PC에서는 한 번 설치한다.
bool webView2Installed() {
  LPWSTR version = nullptr;
  const HRESULT result = GetAvailableCoreWebView2BrowserVersionString(nullptr, &version);
  const bool installed = SUCCEEDED(result) && version != nullptr;
  if (version) CoTaskMemFree(version);
  return installed;
}

bool ensureWebView2Runtime() {
  if (webView2Installed()) return true;

  // 1) 프로그램 폴더에 넣어 둔 마이크로소프트 설치 파일(부트스트래퍼)이 있으면 그걸 실행한다.
  const auto executable = executableDirectory();
  const std::filesystem::path candidates[] = {
    executable / L"게임기획 스튜디오" / L"redist" / L"MicrosoftEdgeWebview2Setup.exe",
    executable / L"redist" / L"MicrosoftEdgeWebview2Setup.exe",
  };
  for (const auto& setup : candidates) {
    if (!std::filesystem::exists(setup)) continue;
    if (MessageBoxW(nullptr,
          L"화면을 그리는 윈도우 부품(WebView2)이 없어 지금 설치합니다.\n인터넷 연결이 필요하고 1~2분 걸립니다.",
          kWindowTitle, MB_OKCANCEL | MB_ICONINFORMATION) != IDOK) {
      return false;
    }
    SHELLEXECUTEINFOW info{};
    info.cbSize = sizeof(info);
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpVerb = L"open";
    info.lpFile = setup.c_str();
    info.lpParameters = L"/silent /install";
    info.nShow = SW_SHOWNORMAL;
    if (ShellExecuteExW(&info) && info.hProcess) {
      WaitForSingleObject(info.hProcess, INFINITE);
      CloseHandle(info.hProcess);
    }
    if (webView2Installed()) return true;
    break;
  }

  // 2) 설치 파일이 없거나 설치에 실패하면 공식 설치 파일을 받을 수 있게 안내한다.
  if (MessageBoxW(nullptr,
        L"화면을 그리는 윈도우 부품(WebView2)이 설치되어 있지 않습니다.\n마이크로소프트 설치 파일을 받을까요? 설치한 뒤 프로그램을 다시 실행하세요.",
        kWindowTitle, MB_YESNO | MB_ICONWARNING) == IDYES) {
    ShellExecuteW(nullptr, L"open", L"https://go.microsoft.com/fwlink/p/?LinkId=2124703", nullptr, nullptr, SW_SHOWNORMAL);
  }
  return false;
}

void initializeWebView() {
  const std::filesystem::path uiDirectory = resolveUiDirectory();
  const std::wstring userData = (g_store->appDataDirectory() / L"WebView2").wstring();

  HRESULT result = CreateCoreWebView2EnvironmentWithOptions(
    nullptr,
    userData.c_str(),
    nullptr,
    Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
      [uiDirectory](HRESULT environmentResult, ICoreWebView2Environment* environment) -> HRESULT {
        if (FAILED(environmentResult) || environment == nullptr) {
          MessageBoxW(g_window, L"WebView2 Runtime을 시작할 수 없습니다.", kWindowTitle, MB_OK | MB_ICONERROR);
          return environmentResult;
        }

        return environment->CreateCoreWebView2Controller(
          g_window,
          Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
            [uiDirectory](HRESULT controllerResult, ICoreWebView2Controller* controller) -> HRESULT {
              if (FAILED(controllerResult) || controller == nullptr) {
                MessageBoxW(g_window, L"화면 컨트롤러를 만들 수 없습니다.", kWindowTitle, MB_OK | MB_ICONERROR);
                return controllerResult;
              }

              g_controller = controller;
              controller->get_CoreWebView2(&g_webView);
              resizeWebView();

              ComPtr<ICoreWebView2Settings> settings;
              if (SUCCEEDED(g_webView->get_Settings(&settings)) && settings) {
                settings->put_IsStatusBarEnabled(FALSE);
                settings->put_AreDefaultContextMenusEnabled(FALSE);
#if defined(NDEBUG)
                settings->put_AreDevToolsEnabled(FALSE);
#endif
              }

              ComPtr<ICoreWebView2_3> webView3;
              if (FAILED(g_webView.As(&webView3)) || !webView3) {
                MessageBoxW(g_window, L"설치된 WebView2가 로컬 UI 로딩을 지원하지 않습니다.", kWindowTitle, MB_OK | MB_ICONERROR);
                return E_NOINTERFACE;
              }

              webView3->SetVirtualHostNameToFolderMapping(
                L"studio.local",
                uiDirectory.c_str(),
                COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS
              );

              EventRegistrationToken messageToken{};
              g_webView->add_WebMessageReceived(
                Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                  [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                    handleWebMessage(args);
                    return S_OK;
                  }
                ).Get(),
                &messageToken
              );

              // 받은 파일을 기록한다. WebView2 기본 다운로드 창은 잠깐 떴다 사라지므로 스튜디오에서 다시 볼 수 있게 한다.
              ComPtr<ICoreWebView2_4> webView4;
              if (SUCCEEDED(g_webView.As(&webView4)) && webView4) {
                EventRegistrationToken downloadToken{};
                webView4->add_DownloadStarting(
                  Callback<ICoreWebView2DownloadStartingEventHandler>(
                    [](ICoreWebView2*, ICoreWebView2DownloadStartingEventArgs* args) -> HRESULT {
                      ComPtr<ICoreWebView2DownloadOperation> operation;
                      if (FAILED(args->get_DownloadOperation(&operation)) || !operation || !g_downloads) return S_OK;
                      LPWSTR path = nullptr;
                      args->get_ResultFilePath(&path);
                      LPWSTR uri = nullptr;
                      operation->get_Uri(&uri);
                      INT64 total = 0;
                      operation->get_TotalBytesToReceive(&total);
                      const std::string id = g_downloads->begin(path ? path : L"", uri ? uri : L"", total);
                      if (path) CoTaskMemFree(path);
                      if (uri) CoTaskMemFree(uri);
                      postJson(g_downloads->listMessage(""));

                      EventRegistrationToken stateToken{};
                      operation->add_StateChanged(
                        Callback<ICoreWebView2StateChangedEventHandler>(
                          [id](ICoreWebView2DownloadOperation* changed, IUnknown*) -> HRESULT {
                            COREWEBVIEW2_DOWNLOAD_STATE state = COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS;
                            changed->get_State(&state);
                            if (state == COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS || !g_downloads) return S_OK;
                            INT64 received = 0;
                            changed->get_BytesReceived(&received);
                            g_downloads->finish(id, state == COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED ? "completed" : "interrupted", received);
                            postJson(g_downloads->listMessage(""));
                            return S_OK;
                          }
                        ).Get(),
                        &stateToken
                      );
                      return S_OK;
                    }
                  ).Get(),
                  &downloadToken
                );
              }

              g_webView->Navigate(L"https://studio.local/index.html");
              return S_OK;
            }
          ).Get()
        );
      }
    ).Get()
  );

  if (FAILED(result)) {
    throw std::runtime_error("WebView2 environment creation failed.");
  }
}

LRESULT CALLBACK windowProcedure(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  switch (message) {
    case WM_NCCALCSIZE:
      if (wParam == TRUE) {
        if (IsZoomed(window)) {
          auto* parameters = reinterpret_cast<NCCALCSIZE_PARAMS*>(lParam);
          MONITORINFO monitorInfo{};
          monitorInfo.cbSize = sizeof(monitorInfo);
          GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST), &monitorInfo);
          parameters->rgrc[0] = monitorInfo.rcWork;
        }
        return 0;
      }
      break;
    case WM_NCHITTEST:
      return resizeBorderHitTest(window, lParam);
    case WM_SIZE:
      resizeWebView();
      return 0;
    case WM_GETMINMAXINFO: {
      auto* info = reinterpret_cast<MINMAXINFO*>(lParam);
      info->ptMinTrackSize.x = 1060;
      info->ptMinTrackSize.y = 680;
      MONITORINFO monitorInfo{};
      monitorInfo.cbSize = sizeof(monitorInfo);
      if (GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST), &monitorInfo)) {
        info->ptMaxPosition.x = monitorInfo.rcWork.left - monitorInfo.rcMonitor.left;
        info->ptMaxPosition.y = monitorInfo.rcWork.top - monitorInfo.rcMonitor.top;
        info->ptMaxSize.x = monitorInfo.rcWork.right - monitorInfo.rcWork.left;
        info->ptMaxSize.y = monitorInfo.rcWork.bottom - monitorInfo.rcWork.top;
      }
      return 0;
    }
    case WM_DPICHANGED: {
      const RECT* suggested = reinterpret_cast<RECT*>(lParam);
      SetWindowPos(window, nullptr, suggested->left, suggested->top,
        suggested->right - suggested->left, suggested->bottom - suggested->top,
        SWP_NOZORDER | SWP_NOACTIVATE);
      return 0;
    }
    case WM_CLOSE:
      if (g_allowExit) {
        DestroyWindow(window);
      } else {
        hideMainWindow();
      }
      return 0;
    case WM_COMMAND:
      if (LOWORD(wParam) == kTrayOpen) {
        showMainWindow();
        return 0;
      }
      if (LOWORD(wParam) == kTrayQuit) {
        quitApplication();
        return 0;
      }
      break;
    case kTrayMessage:
      switch (LOWORD(lParam)) {
        case WM_LBUTTONUP:
        case WM_LBUTTONDBLCLK:
        case NIN_SELECT:
          showMainWindow();
          return 0;
        case WM_RBUTTONUP:
        case WM_CONTEXTMENU:
          showTrayMenu();
          return 0;
      }
      break;
    case kAsyncJsonMessage: {
      std::unique_ptr<json> payload(reinterpret_cast<json*>(lParam));
      if (payload) postJson(*payload);
      return 0;
    }
    case kRestartReviewServerMessage:
      stopReviewAnalyticsServer();
      startReviewAnalyticsServer();
      return 0;
    case WM_DESTROY:
      removeTrayIcon();
      g_controller.Reset();
      g_webView.Reset();
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(window, message, wParam, lParam);
}

} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  const HRESULT comResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  if (FAILED(comResult)) return 1;

  HANDLE mutex = CreateMutexW(nullptr, TRUE, kSingleInstanceMutex);
  if (GetLastError() == ERROR_ALREADY_EXISTS) {
    if (HWND existing = FindWindowW(kWindowClass, nullptr)) {
      ShowWindow(existing, SW_SHOW);
      ShowWindow(existing, SW_RESTORE);
      SetForegroundWindow(existing);
    }
    if (mutex) CloseHandle(mutex);
    CoUninitialize();
    return 0;
  }

  // 화면 부품이 없으면 설치부터 한다. 설치하지 않으면 창을 띄울 수 없으므로 여기서 끝낸다.
  if (!ensureWebView2Runtime()) {
    if (mutex) CloseHandle(mutex);
    CoUninitialize();
    return 0;
  }

  try {
    g_store = std::make_unique<ProjectStore>();
    g_openRouter = std::make_shared<OpenRouterService>(g_store->appDataDirectory());
    g_promptLibrary = std::make_unique<PromptLibraryStore>(g_store->appDataDirectory());
    g_downloads = std::make_unique<DownloadHistory>(g_store->appDataDirectory());
    startReviewAnalyticsServer();
    startPptDesignerServer();

    WNDCLASSEXW windowClass{};
    windowClass.cbSize = sizeof(windowClass);
    windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = windowProcedure;
    windowClass.hInstance = instance;
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    windowClass.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
    windowClass.hIconSm = LoadIconW(nullptr, IDI_APPLICATION);
    windowClass.hbrBackground = CreateSolidBrush(RGB(18, 20, 20));
    windowClass.lpszClassName = kWindowClass;
    if (!RegisterClassExW(&windowClass)) {
      throw std::runtime_error("Window class registration failed.");
    }

    g_window = CreateWindowExW(
      0,
      kWindowClass,
      kWindowTitle,
      WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU,
      CW_USEDEFAULT,
      CW_USEDEFAULT,
      1500,
      920,
      nullptr,
      nullptr,
      instance,
      nullptr
    );
    if (!g_window) {
      throw std::runtime_error("Main window creation failed.");
    }

    const LONG_PTR windowStyle = GetWindowLongPtrW(g_window, GWL_STYLE);
    SetWindowLongPtrW(g_window, GWL_STYLE, windowStyle & ~static_cast<LONG_PTR>(WS_CAPTION));
    SetWindowPos(g_window, nullptr, 0, 0, 0, 0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);

    BOOL darkMode = TRUE;
    DwmSetWindowAttribute(g_window, 20, &darkMode, sizeof(darkMode));
    addTrayIcon();
    initializeWebView();
    ShowWindow(g_window, showCommand);
    UpdateWindow(g_window);

    MSG message{};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) {
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
  } catch (const std::exception& error) {
    const std::wstring message = utf8ToWide(error.what());
    MessageBoxW(nullptr, message.c_str(), kWindowTitle, MB_OK | MB_ICONERROR);
    removeTrayIcon();
  }

  stopReviewAnalyticsServer();
  stopPptDesignerServer();
  g_store.reset();
  g_openRouter.reset();
  g_promptLibrary.reset();
  if (mutex) CloseHandle(mutex);
  CoUninitialize();
  return 0;
}
