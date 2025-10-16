import { Injectable } from "@nestjs/common";
import { IMcpToolResponseHandler } from "../../interfaces";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { ModuleMetadataService } from "../module-metadata.service";
import { CreateModuleMetadataDto } from "src/dtos/create-module-metadata.dto";
import { SolidRegistry } from "src/helpers/solid-registry";

@Injectable()
export class SolidCreateModuleMcpToolResponseHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly moduleMetadataService: ModuleMetadataService,
        private readonly solidRegistry: SolidRegistry,

    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        const aiResponseMessage = JSON.parse(aiInteraction.message);

        const moduleMetadata = aiResponseMessage?.moduleMetadata ?? {};

        // TODO: Validate if another module with same name exists, if it does then raise an error...

        const createDto: CreateModuleMetadataDto = {
            defaultDataSource: 'default',
            description: moduleMetadata['description'],
            displayName: moduleMetadata['displayName'],
            isSystem: false,
            menuIconUrl: '',
            models: [],
            name: moduleMetadata['name'],
            menuSequenceNumber: 1
        }

        // This creates the module-metadata.json file....
        const moduleObj = await this.moduleMetadataService.create(createDto);

        // const seeder = this.solidRegistry.getSeeders().filter((seeder) => seeder.name === 'ModuleMetadataSeederService').map((seeder) => seeder.instance).pop();

        // Now we need to run solid seed & then solid refresh-model --name <module-name>
        await this.moduleMetadataService.generateCode({ moduleId: moduleObj.id });

        // solid seed ... this has to be run after reboot from the UI...
        // await new Promise(resolve => setTimeout(resolve, 1000));
        // await seeder.seed();

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: true,
            serverRebooting: true,
        }
    }

}