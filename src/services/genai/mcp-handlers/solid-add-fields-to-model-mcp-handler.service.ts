import { Injectable } from "@nestjs/common";
import { UpdateModelMetaDataDto } from "src/dtos/update-model-metadata.dto";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { IMcpToolResponseHandler } from "../../../interfaces";
import { ModelMetadataService } from "../../model-metadata.service";

@Injectable()
// solid_add_field
export class SolidAddFieldsToModelMcpHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly modelMetadataService: ModelMetadataService,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        // const aiResponse = JSON.parse(aiInteraction.message);
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponseMessage = JSON.parse(escapedMessage);

        // {
        //   "generation_status": "success",
        //   "instructions": "<optional string>",
        //   "data": {
        //     "modelUserKey": "<existing model name>",
        //     "schemaPatch": {
        //       "fieldsToAdd": [
        //         <json representing each of the fields to be added>
        //       ]
        //     }
        //   }
        // }        
        // const { modelUserKey, fieldSchema } = aiResponseMessage;
        const { data } = aiResponseMessage;
        const { modelUserKey, schemaPatch } = data;
        const { fieldsToAdd } = schemaPatch;

        // TODO: Validate if another field with same name exists, if it does then raise an error...

        // TODO: load the model with the fields.
        const modelMetadata = await this.modelMetadataService.findOneByUserKey(modelUserKey, ['fields']);
        if (!modelMetadata) {
            throw new Error(`Model with user key ${modelUserKey} not found.`);
        }

        for (let i = 0; i < fieldsToAdd.length; i++) {
            const fieldSchema = fieldsToAdd[i];

            // Add the fieldSchema to the model fields array
            fieldSchema['modelId'] = modelMetadata.id;
            modelMetadata.fields.push(fieldSchema as FieldMetadata);
        }

        // This adds the field to the respective model metadat...
        await this.modelMetadataService.update(modelMetadata.id, modelMetadata as unknown as UpdateModelMetaDataDto);

        // Now we need to run solid seed & then solid refresh-model --name <module-name>
        await this.modelMetadataService.handleGenerateCode({ modelId: modelMetadata.id });

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: true,
            serverRebooting: true,
        }
    }

}