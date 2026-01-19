import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import * as fs from 'fs';
import * as path from 'path';
import { ISolidDatabaseModule } from 'src/interfaces';
import { getDynamicModuleNames } from 'src/helpers/module.helper';
import { SolidRegistry } from 'src/helpers/solid-registry';

interface InfoCommandOptions {
    detailed?: boolean;
}

@Command({ name: 'info', description: 'Prints information about the consuming project' })
export class InfoCommand extends CommandRunner {
    private readonly logger = new Logger(InfoCommand.name);

    constructor(private readonly solidRegistry: SolidRegistry) {
        super();
    }

    async run(passedParam: string[], options?: InfoCommandOptions): Promise<void> {
        const enabledModules = getDynamicModuleNames();
        const dataSources = this.getDataSources();

        const output = {
            modules: {
                count: enabledModules.length,
                names: enabledModules,
            },
            dataSources: {
                count: dataSources.length,
                items: dataSources,
            },
        };

        console.log(JSON.stringify(output, null, 2));
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
    @Option({ flags: '-d, --detailed [boolean]', description: 'Print more details about the consuming project', required: false, defaultValue: false })
    parseDetached(val: string): boolean {
        if (val === undefined) return false;
        return val === 'true' || val === '1';
    }
}
