#pragma once

#include <filesystem>
#include <string>

#include <nlohmann/json.hpp>

// 스튜디오 안에서 받은 파일(내보내기 xlsx, 백업 gsw 등)의 기록.
// WebView2 기본 다운로드 창은 잠깐 떴다 사라지므로, 무엇을 어디에 받았는지 여기서 다시 볼 수 있게 한다.
// 파일 자체는 지우지 않는다. 기록만 남기고 지운다.
class DownloadHistory {
public:
  explicit DownloadHistory(std::filesystem::path appDataDirectory);

  // 다운로드가 시작되면 기록을 만들고 id를 돌려준다.
  std::string begin(const std::wstring& filePath, const std::wstring& sourceUrl, long long totalBytes);
  // 끝나면(완료·중단) 상태와 크기를 적는다.
  void finish(const std::string& id, const std::string& state, long long receivedBytes);

  // downloads:list / downloads:open / downloads:reveal / downloads:remove / downloads:clear
  nlohmann::json handleCommand(const nlohmann::json& command);
  nlohmann::json listMessage(const std::string& requestId) const;

private:
  using json = nlohmann::json;

  std::filesystem::path path_;
  json items_;

  void load();
  void save() const;
  json* find(const std::string& id);
  static std::string nowIso8601();
  static std::string newId();
  static std::string wideToUtf8(const std::wstring& value);
  static std::wstring utf8ToWide(const std::string& value);
};
