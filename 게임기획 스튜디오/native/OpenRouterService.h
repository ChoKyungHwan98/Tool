#pragma once

#include <filesystem>
#include <string>

#include <nlohmann/json.hpp>

class OpenRouterService {
public:
  explicit OpenRouterService(std::filesystem::path appDataDirectory);
  nlohmann::json handleCommand(const nlohmann::json& command);
  // Used only to seed the local review-analysis child process at launch.
  // Callers must never serialize or return this value to the web UI.
  static std::string readApiKey();

private:
  std::filesystem::path usagePath_;

  static void saveApiKey(const std::string& key);
  static void deleteApiKey();
  static nlohmann::json request(
      const std::wstring& method,
      const std::wstring& path,
      const std::string& body,
      const std::string& apiKey);
  nlohmann::json loadUsage() const;
  void saveUsage(const nlohmann::json& usage) const;
  nlohmann::json budgetStatus(double monthlyLimit) const;
  static std::string monthKey();
};
