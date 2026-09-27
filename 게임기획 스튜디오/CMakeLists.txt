cmake_minimum_required(VERSION 3.24)

project(GameDesignStudio VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz
  URL_HASH SHA256=42f6e95cad6ec532fd372391373363b62a14af6d771056dbfc86160e6dfff7aa
)
FetchContent_MakeAvailable(nlohmann_json)

include(cmake/WebView2.cmake)

add_executable(GameDesignStudio WIN32
  native/main.cpp
  native/ProjectStore.cpp
  native/ProjectStore.h
  native/OpenRouterService.cpp
  native/OpenRouterService.h
  native/PromptLibraryStore.cpp
  native/PromptLibraryStore.h
  native/DownloadHistory.cpp
  native/DownloadHistory.h
)

target_compile_definitions(GameDesignStudio PRIVATE
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
  _WIN32_WINNT=0x0A00
  GDS_VERSION="${PROJECT_VERSION}"
  GDS_UI_SOURCE_DIR=L"${CMAKE_SOURCE_DIR}/ui/dist"
)

target_include_directories(GameDesignStudio PRIVATE
  ${WEBVIEW2_INCLUDE_DIR}
  native
)

target_link_libraries(GameDesignStudio PRIVATE
  ${WEBVIEW2_STATIC_LIBRARY}
  nlohmann_json::nlohmann_json
  comctl32
  dwmapi
  ole32
  shell32
  shlwapi
  user32
  version
  advapi32
  winhttp
)

if(MSVC)
  target_compile_options(GameDesignStudio PRIVATE /W4 /permissive- /utf-8)
  target_link_options(GameDesignStudio PRIVATE /SUBSYSTEM:WINDOWS)
endif()

set(UI_DIST_DIR "${CMAKE_SOURCE_DIR}/ui/dist")
add_custom_command(TARGET GameDesignStudio POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E rm -rf "$<TARGET_FILE_DIR:GameDesignStudio>/assets/ui"
  COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:GameDesignStudio>/assets/ui"
  COMMAND ${CMAKE_COMMAND} -E copy_directory "${UI_DIST_DIR}" "$<TARGET_FILE_DIR:GameDesignStudio>/assets/ui"
  COMMENT "Copying local UI assets"
)

install(TARGETS GameDesignStudio RUNTIME DESTINATION .)
install(DIRECTORY "${UI_DIST_DIR}/" DESTINATION assets/ui)

enable_testing()
add_executable(GameDesignStudioStoreTests
  native/ProjectStoreTests.cpp
  native/ProjectStore.cpp
  native/ProjectStore.h
  native/OpenRouterService.cpp
  native/OpenRouterService.h
  native/PromptLibraryStore.cpp
  native/PromptLibraryStore.h
)
target_compile_definitions(GameDesignStudioStoreTests PRIVATE
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
  GDS_VERSION="${PROJECT_VERSION}"
)
target_include_directories(GameDesignStudioStoreTests PRIVATE native)
target_link_libraries(GameDesignStudioStoreTests PRIVATE
  nlohmann_json::nlohmann_json
  ole32
  shell32
  advapi32
  winhttp
)
if(MSVC)
  target_compile_options(GameDesignStudioStoreTests PRIVATE /W4 /permissive- /utf-8)
endif()
add_test(NAME ProjectStorePersistence COMMAND GameDesignStudioStoreTests)
