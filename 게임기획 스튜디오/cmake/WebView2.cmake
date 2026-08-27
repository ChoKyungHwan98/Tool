set(WEBVIEW2_VERSION "1.0.4078.44" CACHE STRING "Microsoft.Web.WebView2 NuGet version")
string(TOLOWER "${WEBVIEW2_VERSION}" WEBVIEW2_VERSION_LOWER)

set(WEBVIEW2_ROOT "${CMAKE_BINARY_DIR}/_deps/webview2-${WEBVIEW2_VERSION}")
set(WEBVIEW2_PACKAGE "${CMAKE_BINARY_DIR}/_deps/microsoft.web.webview2.${WEBVIEW2_VERSION}.nupkg")

if(NOT EXISTS "${WEBVIEW2_ROOT}/build/native/include/WebView2.h")
  file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/_deps")
  file(DOWNLOAD
    "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${WEBVIEW2_VERSION_LOWER}/microsoft.web.webview2.${WEBVIEW2_VERSION_LOWER}.nupkg"
    "${WEBVIEW2_PACKAGE}"
    EXPECTED_HASH SHA256=dc4d1d9168df26b830398303e50210b6e1729f6ce5a7ac69d2c766852f489962
    TLS_VERIFY ON
    SHOW_PROGRESS
  )
  file(MAKE_DIRECTORY "${WEBVIEW2_ROOT}")
  file(ARCHIVE_EXTRACT INPUT "${WEBVIEW2_PACKAGE}" DESTINATION "${WEBVIEW2_ROOT}")
endif()

set(WEBVIEW2_INCLUDE_DIR "${WEBVIEW2_ROOT}/build/native/include")

if(CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(WEBVIEW2_ARCH x64)
else()
  set(WEBVIEW2_ARCH x86)
endif()

set(WEBVIEW2_STATIC_LIBRARY "${WEBVIEW2_ROOT}/build/native/${WEBVIEW2_ARCH}/WebView2LoaderStatic.lib")

if(NOT EXISTS "${WEBVIEW2_STATIC_LIBRARY}")
  message(FATAL_ERROR "WebView2 loader library not found: ${WEBVIEW2_STATIC_LIBRARY}")
endif()
