import { Injectable, Logger } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IWhatsAppTransport } from "src/interfaces";
import { SettingService } from "src/services/setting.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

@Injectable()
export class WhatsAppFactory {
  private readonly logger = new Logger(WhatsAppFactory.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly solidRegistry: SolidRegistry,
    private readonly settingService: SettingService,
  ) {}

  getWhatsappService(name?: string): IWhatsAppTransport {
    const providerKey =
      name ||
      this.settingService.getConfigValue<SolidCoreSetting>("whatsappProvider");

    if (!providerKey) {
      throw new Error("Unable to resolve whatsapp provider");
    }

    const whatsappProviders = this.solidRegistry.getWhatsappProviders();

    if (!whatsappProviders.length) {
      throw new Error("No whatsapp providers are registered.");
    }

    const whatsappServiceProvider = whatsappProviders.find((provider) =>
      provider.name?.toLowerCase().includes(providerKey.toLowerCase()),
    );

    if (!whatsappServiceProvider) {
      throw new Error(`WhatsApp provider '${providerKey}' not found`);
    }

    return whatsappServiceProvider.instance as IWhatsAppTransport;
  }
}
