import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IWhatsAppTransport } from "src/interfaces";

function norm(s?: string) {
    return s?.trim().toLowerCase();
}

// This factory will be use to return a mail service instance, using the configured environment variables
@Injectable()
export class WhatsAppFactory {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        private readonly moduleRef: ModuleRef, // Use the module ref to dynamically resolve the mail service
        private readonly solidRegistry: SolidRegistry,
    ) { }

    getWhatsappService(name: string = null): IWhatsAppTransport {
        // This is the default provider
        const whatsappServiceName = name || process.env.COMMON_WHATSAPP_PROVIDER;
        if (!whatsappServiceName) {
            throw new Error("Unable to resolve whatsapp provider")
        }
        const whatsappProviders = this.solidRegistry.getWhatsappProviders();

        // Return the instance which matches the whatsappServiceName
        if (!whatsappProviders.length) {
            // throw new Error("No mail providers are registered.");
            this.logger.error("No whatsapp providers are registered.");
        }

        const whatsappServiceProvider = whatsappProviders.find(provider => provider.name === whatsappServiceName);

        return whatsappServiceProvider.instance as IWhatsAppTransport;
    }

}