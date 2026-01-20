import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IMail } from "src/interfaces";

function norm(s?: string) {
    return s?.trim().toLowerCase();
}

// This factory will be use to return a mail service instance, using the configured environment variables
@Injectable()
export class MailFactory {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        private readonly moduleRef: ModuleRef, // Use the module ref to dynamically resolve the mail service
        private readonly solidRegistry: SolidRegistry,
    ) { }


    getMailService(): IMail {
        const mailServiceName = process.env.COMMON_EMAIL_PROVIDER ?? "SMTPEMailService";
        const mailProviders = this.solidRegistry.getMailProviders();
        // Return the instance which matches the mailServiceName
        if (!mailProviders.length) {
            // throw new Error("No mail providers are registered.");
            this.logger.error("No mail providers are registered.");
        }

        const mailServiceProvider = mailProviders.find(provider => provider.name === mailServiceName);

        return mailServiceProvider.instance as IMail;
    }

}