import { Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IPushNotification } from "src/interfaces";
import { SettingService } from "src/services/setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

@Injectable()
export class PushNotificationFactory {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly solidRegistry: SolidRegistry,
    private readonly settingService: SettingService,
  ) {}

  getPushNotificationService(name: string = null): IPushNotification {
    const pushNotificationServiceName =
      name ||
      this.settingService.getConfigValue<SolidCoreSetting>(
        "pushNotificationProvider",
      );

    if (!pushNotificationServiceName) {
      throw new Error("Unable to resolve push notification provider");
    }

    const pushNotificationProviders =
      this.solidRegistry.getPushNotificationProviders();

    if (!pushNotificationProviders.length) {
      this.logger.error("No push notification providers are registered.");
    }

    const pushNotificationProvider = pushNotificationProviders.find(
      (provider) => provider.name === pushNotificationServiceName,
    );

    return pushNotificationProvider?.instance as IPushNotification;
  }
}
