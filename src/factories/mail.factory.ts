import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import commonConfig from "src/config/common.config";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IMail } from "src/interfaces";
import { SMTPEMailService } from "src/services/mail/smtp-email.service";

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
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    ) { }


    getMailService(): IMail {
        const mailServiceName = this.commonConfiguration.emailProvider;
        const mailProviders = this.solidRegistry.getMailProviders();
        const token = this.returnProviderToken(mailProviders, mailServiceName);

        // Use the module ref to dynamically resolve the mail service
        const mailService = this.moduleRef.get(token, { strict: false });
        return mailService;
    }

    /**
 * Find the provider token that matches the given name.
 * - Matches class tokens by constructor name
 * - Matches string tokens by exact (case-insensitive) value
 * - Matches symbol tokens by description
 * - If name is empty, returns the first mail provider's token
 */
    private returnProviderToken(
        wrappers: InstanceWrapper[],
        name: string,
    ): string | symbol | Function {
        // trim the name
        const target = norm(name);

        if (!wrappers.length) {
            throw new Error('No mail providers are registered.');
        }

        // If a name is provided, try to match it
        if (target) {
            const match = wrappers.find((w) => {
                const t = w.token as any;

                if (typeof t === 'function') {
                    // Prefer token.name; fallback to instance ctor name (just in case)
                    const className = t.name || w.instance?.constructor?.name;
                    return norm(className) === target;
                }
                if (typeof t === 'string') {
                    return norm(t) === target;
                }
                if (typeof t === 'symbol') {
                    return norm(t.description ?? '') === target;
                }
                return false;
            });

            if (match) return match.token as any;

            const available = wrappers
                .map((w) =>
                    typeof w.token === 'function'
                        ? (w.token as Function).name
                        : typeof w.token === 'string'
                            ? w.token
                            : typeof w.token === 'symbol'
                                ? (w.token as symbol).description ?? '<symbol>'
                                : '<??>',
                )
                .join(', ');
            this.logger.error(`Mail provider ${name} not found. Available: [${available}]`);
        }

        // No name provided → pick the first provider’s token
        return SMTPEMailService;
    }
}