import { Logger } from "@nestjs/common";
import { Command, CommandRunner, Option } from "nest-commander";
import { RemovedFieldMigrationService } from "src/services/removed-field-migration.service";
import { CommandError } from "./helper";
import { ModelMetadataService } from "src/services/model-metadata.service";

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
        private readonly modelMetadataService: ModelMetadataService,

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

        // STEP 1: Capture fields BEFORE migration deletes metadata
        // const model = await this.modelMetadataService.findOneByUserKey(
        //     options.name,
        //     ["module", "fields"],
        // );

        // const fieldsForRemoval = model.fields.filter(
        //     field => field.isMarkedForRemoval,
        // );

        // // STEP 2: Run remove-fields schematic first
        // if (!dryRun && fieldsForRemoval.length > 0) {
        //     // await this.modelMetadataService.executeRemoveFieldsOnly(options.name,fieldsForRemoval.map(f => f.name),false,);
        //     await this.modelMetadataService.executeRemoveFieldsWithModel(model,                                    fieldsForRemoval.map(f => f.name),false,);
        // }

        // STEP 3: Then perform DB + metadata cleanup
        const result = await this.removedFieldMigrationService.migrateMarkedFields(options.name, dryRun,);

        result.operations.forEach((operation) => this.logger.log(operation));
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
