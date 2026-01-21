import { Injectable } from "@nestjs/common";
import { SettingsProvider } from "src/decorators/settings-provider.decorator";
import { ISettingsProvider, SettingLevel } from "src/interfaces";


@SettingsProvider()
@Injectable()
export class SolidCoreQueuesSettingsProvider implements ISettingsProvider {

  getSettings() {
    return [
      { key: "queuesDefaultBroker", value: process.env.QUEUES_DEFAULT_BROKER || 'database', level: SettingLevel.SystemAdminReadonly },
      { key: "queuesServiceRole", value: process.env.QUEUES_SERVICE_ROLE, level: SettingLevel.SystemAdminReadonly },
      { key: "queuesRabbitMqUrl", value: process.env.QUEUES_RABBIT_MQ_URL, level: SettingLevel.SystemEnv },
      { key: "solidCliRunning", value: process.env.SOLID_CLI_RUNNING || "false", level: SettingLevel.SystemEnv },
    ];
  }
}
