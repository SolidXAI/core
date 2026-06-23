import { Logger } from "@nestjs/common";
import { Command, CommandRunner, Option } from "nest-commander";
import { RemovedFieldMigrationService } from "src/services/removed-field-migration.service";
import { CommandError } from "./helper";

interface CommandOptions {
    name: string;
    dryRun?: boolean;
}

@Command({
    name: "migrate-removed-fields",
    description: "Drops live database artifacts for fields marked for removal and cleans the related metadata.",
})
export class MigrateRemovedFieldsCommand extends CommandRunner {
    constructor(
        private readonly removedFieldMigrationService: RemovedFieldMigrationService,
    ) {
        super();
    }

    private readonly logger = new Logger(MigrateRemovedFieldsCommand.name);

    async run(_passedParam: string[], options?: CommandOptions): Promise<void> {
        const errors = this.validate(options);
        if (errors.length) {
            errors.forEach((error) => this.logger.error(error));
            return;
        }

        const dryRun = options?.dryRun ?? true;
        const result = await this.removedFieldMigrationService.migrateMarkedFields(options.name, dryRun);
        result.operations.forEach((operation) => this.logger.log(operation));
        this.logger.log(`Processed ${result.removedFieldNames.length} field(s) for model "${result.modelName}".`);
    }

    @Option({
        flags: "-n, --name <model name>",
        description: "Model name (singularName) from the ss_model_metadata table",
    })
    parseName(val: string): string {
        return val;
    }

    @Option({
        flags: "-d, --dryRun [dry run]",
        description: "Dry run the command",
    })
    parseDryRun(val: string): boolean {
        this.logger.debug(`Dry run : ${val}`);
        return val === "false" ? false : true;
    }

    private validate(options: CommandOptions): CommandError[] {
        if (!options?.name) {
            return [new CommandError("Model Name is required")];
        }
        return [];
    }
}
