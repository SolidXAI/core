import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ISolidDatabaseModule } from 'src/interfaces';
import { getDynamicModuleNames } from 'src/helpers/module.helper';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { SettingService } from 'src/services/setting.service';
import { InfoService } from 'src/services/info.service';

interface InfoCommandOptions {
    detailed?: boolean;
}

@Command({ name: 'info', description: 'Prints information about the consuming project' })
export class InfoCommand extends CommandRunner {
    private readonly logger = new Logger(InfoCommand.name);

    constructor(
        private readonly solidRegistry: SolidRegistry,
        private readonly settingService: SettingService,
        private readonly infoService: InfoService,
    ) {
        super();
    }

    async run(passedParam: string[], options?: InfoCommandOptions): Promise<void> {
        const enabledModules = getDynamicModuleNames();
        const dataSources = this.getDataSources();

        const output: Record<string, any> = {
            packages: this.infoService.getPackageVersions(),
            modules: {
                count: enabledModules.length,
                names: enabledModules,
            },
            dataSources: {
                count: dataSources.length,
                items: dataSources,
            },
        };

        if (options?.detailed) {
            output.registry = this.getRegistryDetails();
        }

        console.log(JSON.stringify(output, null, 2));
    }

    private getRegistryDetails(): Record<string, unknown> {
        const info = {
            settings: this.settingService.getAllSettings(),
            seeders: this.getWrapperNames(this.solidRegistry.getSeeders()),
            scheduledJobProviders: this.getWrapperNames(this.solidRegistry.getScheduledJobProviders()),
            selectionProviders: this.getWrapperNames(this.solidRegistry.getSelectionProviders()),
            computedFieldProviders: this.getWrapperNames(this.solidRegistry.getComputedFieldProviders()),
            solidDatabaseModules: this.getWrapperNames(this.solidRegistry.getSolidDatabaseModules()),
            mailProviders: this.getWrapperNames(this.solidRegistry.getMailProviders()),
            whatsappProviders: this.getWrapperNames(this.solidRegistry.getWhatsappProviders()),
            smsProviders: this.getWrapperNames(this.solidRegistry.getSmsProviders()),
            securityRuleConfigProviders: this.getWrapperNames(this.solidRegistry.getSecurityRuleConfigProviders()),
            errorCodeProviders: this.getWrapperNames(this.solidRegistry.getErrorCodeProviders()),
            controllers: this.solidRegistry.getControllers().map((controller) => controller.name),
            // modules: this.getWrapperNames(this.solidRegistry.getModules()),
            // computedFieldMetadata: {
            //     count: this.solidRegistry.getComputedFieldMetadata().length,
            // },
            // defaultLocale: this.solidRegistry.getDefaultLocale()?.locale ?? null,
        };

        return info;
    }

    private getWrapperNames(wrappers: Array<{ name?: string; instance?: any }>): string[] {
        return wrappers
            .map((wrapper) => wrapper.name || wrapper.instance?.constructor?.name)
            .filter((name): name is string => !!name);
    }

    private getDataSources(): Array<{ name: string; type: string | null }> {
        const fromRegistry = this.solidRegistry
            .getSolidDatabaseModules()
            .map((wrapper) => wrapper.instance as ISolidDatabaseModule)
            .filter((module): module is ISolidDatabaseModule => !!module)
            .map((module) => ({
                name: module.name?.(),
                type: module.type?.() ?? null,
            }))
            .filter((item) => !!item.name);


        return fromRegistry;

    }

    // Flags
    @Option({ flags: '-d, --detailed', description: 'Print more details about the consuming project' })
    parseDetailed(): boolean {
        return true;
    }
}
