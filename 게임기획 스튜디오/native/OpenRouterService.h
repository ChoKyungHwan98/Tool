#pragma once

#include <filesystem>
#include <string>

#include <nlohmann/json.hpp>

class OpenRouterService {
public:
  explicit OpenRouterService(std::filesystem::path appDataDirectory);
  nlohmann::json handleCommand(const nlohmann::json& command);

private:
  std::filesystem::path usagePath_;

  static std::string readApiKey();
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
