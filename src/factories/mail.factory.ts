import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import commonConfig from "src/config/common.config";
import { IMail } from "src/interfaces";

// This factory will be use to return a mail service instance, using the configured environment variables
@Injectable()
export class MailFactory {
    constructor(
        private readonly moduleRef: ModuleRef, // Use the module ref to dynamically resolve the mail service
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    ) { }

    getMailService(): IMail {
        const mailServiceName = this.commonConfiguration.emailProvider;
        // Use the module ref to dynamically resolve the mail service
        const mailService = this.moduleRef.get(mailServiceName, { strict: false });
        return mailService;
    }
}