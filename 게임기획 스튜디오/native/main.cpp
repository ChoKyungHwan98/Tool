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

#include "ProjectStore.h"
#include "OpenRouterService.h"
#include "PromptLibraryStore.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
using json = nlohmann::json;

namespace {

constexpr wchar_t kWindowClass[] = L"GameDesignStudioWindow";
constexpr wchar_t kWindowTitle[] = L"게임기획 스튜디오";
constexpr wchar_t kSingleInstanceMutex[] = L"Local\\GameDesignStudio.SingleInstance";
constexpr UINT kTrayMessage = WM_APP + 17;
constexpr UINT kAsyncJsonMessage = WM_APP + 18;
constexpr UINT kTrayOpen = 41001;
constexpr UINT kTrayQuit = 41002;

HWND g_window = nullptr;
NOTIFYICONDATAW g_trayIcon{};
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webView;
std::unique_ptr<ProjectStore> g_store;
std::shared_ptr<OpenRouterService> g_openRouter;
std::unique_ptr<PromptLibraryStore> g_promptLibrary;
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
    wcscpy_s(g_trayIcon.szInfoTitle, L"게임기획 스튜디오");
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
  AppendMenuW(menu, MF_STRING | MF_DEFAULT, kTrayOpen, L"게임기획 스튜디오 열기");
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
      }).detach();
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

  try {
    g_store = std::make_unique<ProjectStore>();
    g_openRouter = std::make_shared<OpenRouterService>(g_store->appDataDirectory());
    g_promptLibrary = std::make_unique<PromptLibraryStore>(g_store->appDataDirectory());

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

  g_store.reset();
  g_openRouter.reset();
  g_promptLibrary.reset();
  if (mutex) CloseHandle(mutex);
  CoUninitialize();
  return 0;
}
