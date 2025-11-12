import { Injectable } from "@nestjs/common";
import { IMcpToolResponseHandler } from "../../../interfaces";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { ModelMetadataService } from "../../model-metadata.service";
import { CreateModelMetadataDto } from "src/dtos/create-model-metadata.dto";
import { ModuleMetadataService } from "../../module-metadata.service";

@Injectable()
export class SolidCreateModelWithFieldsMcpHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly moduleMetadataService: ModuleMetadataService,
        private readonly modelMetadataService: ModelMetadataService,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        // const aiResponse = JSON.parse(aiInteraction.message);
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponseMessage = JSON.parse(escapedMessage);

        const { generation_status, instructions, data } = aiResponseMessage;
        const { moduleUserKey, schema } = data;
        const moduleMetadata = await this.moduleMetadataService.findOneByUserKey(moduleUserKey);
        if (!moduleMetadata) {
            throw new Error(`Module with user key ${moduleUserKey} not found.`);
        }
        schema['moduleId'] = moduleMetadata.id;

        // TODO: Validate if another model with same name exists, if it does then raise an error...

        // This creates the module-metadata.json file....
        const modelObj = await this.modelMetadataService.create(schema as CreateModelMetadataDto);

        // Now we need to run solid seed & then solid refresh-model --name <module-name>
        await this.modelMetadataService.handleGenerateCode({ modelId: modelObj.id });

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: true,
            serverRebooting: true,
        }
    }

}