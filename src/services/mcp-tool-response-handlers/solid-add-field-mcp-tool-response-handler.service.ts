import { Injectable } from "@nestjs/common";
import { IMcpToolResponseHandler } from "../../interfaces";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { SolidRegistry } from "src/helpers/solid-registry";
import { ModelMetadataService } from "../model-metadata.service";
import { CreateModelMetadataDto } from "src/dtos/create-model-metadata.dto";
import { CreateFieldMetadataDto } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldMetadataService } from "../field-metadata.service";

@Injectable()
// solid_add_field
export class SolidAddFieldMcpToolResponseHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly modelMetadataService: ModelMetadataService,
        private readonly fieldMetadataService: FieldMetadataService,
        private readonly solidRegistry: SolidRegistry,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        // const aiResponse = JSON.parse(aiInteraction.message);
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponse = JSON.parse(escapedMessage);

        const { modelUserKey, fieldSchema } = aiResponse;

        // TODO: Validate if another field with same name exists, if it does then raise an error...

        // TODO: load the model and save the field against that model.
        const modelMetadata = await this.modelMetadataService.findOneByUserKey(modelUserKey);
        if (!modelMetadata) {
            throw new Error(`Model with user key ${modelUserKey} not found.`);
        }

        fieldSchema['modelId'] = modelMetadata.id;

        // This creates the module-metadata.json file....
        const modelObj = await this.fieldMetadataService.create(fieldSchema as CreateFieldMetadataDto);

        // Now we need to run solid seed & then solid refresh-model --name <module-name>
        await this.modelMetadataService.handleGenerateCode({ modelId: modelObj.id });

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: true,
            serverRebooting: true,
        }
    }

}