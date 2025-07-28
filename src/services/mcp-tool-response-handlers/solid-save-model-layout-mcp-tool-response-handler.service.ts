import { Injectable } from "@nestjs/common";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { ViewMetadataRepository } from "src/repository/view-metadata.repository";
import { IMcpToolResponseHandler } from "../../interfaces";

@Injectable()
export class SolidSaveModelLayoutMcpToolResponseHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly viewMetadataRepository: ViewMetadataRepository,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        const aiResponse = JSON.parse(aiInteraction.message);

        // Get the data for resolving the view metadata
        const {name, modelUserKey, moduleUserKey, layout} = aiResponse['moduleMetadata'];

        // Fetch the view metadata for the given model and module and the view name
        const viewMetadata = await this.viewMetadataRepository.findByNameAndModelNameAndModuleName(name, modelUserKey, moduleUserKey);

        viewMetadata.layout = layout;
        // Save the updated view metadata
        await this.viewMetadataRepository.save(viewMetadata);

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: false,
            serverRebooting: false,
        }
    }

}