import { Injectable } from "@nestjs/common";
import { UpdateModelMetaDataDto } from "src/dtos/update-model-metadata.dto";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IMcpToolResponseHandler } from "../../interfaces";
import { FieldMetadataService } from "../field-metadata.service";
import { ModelMetadataService } from "../model-metadata.service";

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

        // TODO: load the model with the fields.
        const modelMetadata = await this.modelMetadataService.findOneByUserKey(modelUserKey, ['fields']);
        if (!modelMetadata) {
            throw new Error(`Model with user key ${modelUserKey} not found.`);
        }

        // Add the fieldSchema to the model fields array
        fieldSchema['modelId'] = modelMetadata.id;
        modelMetadata.fields.push(fieldSchema as FieldMetadata);

        const modelObj = await this.modelMetadataService.update(modelMetadata.id, modelMetadata as unknown as UpdateModelMetaDataDto);


        // This creates the module-metadata.json file....
        // const modelObj = await this.fieldMetadataService.create(fieldSchema as CreateFieldMetadataDto);

        // Now we need to run solid seed & then solid refresh-model --name <module-name>
        await this.modelMetadataService.handleGenerateCode({ modelId: modelMetadata.id });

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: true,
            serverRebooting: true,
        }
    }

}