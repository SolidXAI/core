import { Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { SolidRegistry } from "src/helpers/solid-registry";
import { ISMS } from "src/interfaces";
import { SettingService } from "src/services/setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

function norm(s?: string) {
  return s?.trim().toLowerCase();
}

// This factory will be use to return a mail service instance, using the configured environment variables
@Injectable()
export class SmsFactory {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly solidRegistry: SolidRegistry,
    private readonly settingService: SettingService,
    // @Inject(commonConfig.KEY)
    // private readonly commonConfiguration: ConfigType<typeof commonConfig>,
  ) {}

  getSmsService(name: string = null): ISMS {
    const smsServiceName =
      name ||
      this.settingService.getConfigValue<SolidCoreSetting>("smsProvider");

    if (!smsServiceName) {
      throw new Error("Unable to resolve sms provider");
    }

    const smsProviders = this.solidRegistry.getSmsProviders();

    if (!smsProviders.length) {
      this.logger.error("No sms providers are registered.");
      throw new Error("No sms providers are registered.");
    }

    const smsServiceProvider = smsProviders.find((provider) =>
      norm(provider.name)?.includes(norm(smsServiceName)),
    );

    if (!smsServiceProvider) {
      throw new Error(`SMS provider '${smsServiceName}' not found`);
    }

    return smsServiceProvider.instance as ISMS;
  }
}
