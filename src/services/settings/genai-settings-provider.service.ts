import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreGenaiSettingsProvider implements ISettingsProvider {

  getSettings() {
    return [
      { key: "ragServerUrl", value: process.env.GENAI_RAG_SERVER_URL, level: SettingLevel.SystemAdminReadonly },
      { key: "ragServerLogin", value: process.env.GENAI_RAG_SERVER_LOGIN, level: SettingLevel.SystemEnv },
      { key: "ragServerPassword", value: process.env.GENAI_RAG_SERVER_PASSWORD, level: SettingLevel.SystemEnv },
      { key: "mcpPythonExecutable", value: process.env.MCP_PYTHON_EXECUTABLE, level: SettingLevel.SystemEnv },
      { key: "mcpClient", value: process.env.MCP_CLIENT, level: SettingLevel.SystemEnv },
      { key: "mcpRestartTouchFile", value: process.env.MCP_RESTART_TOUCH_FILE || "tmp/restart.touch", level: SettingLevel.SystemEnv },
    ];
  }
}
