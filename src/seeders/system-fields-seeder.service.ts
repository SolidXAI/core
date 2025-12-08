// This class will add the system fields in the field-metadata table if they are missing.
// Fetch all the models and their fields metadata and check if the system fields are present.

import { Injectable } from "@nestjs/common";
import { ModelMetadata } from "src/entities/model-metadata.entity";
import { ModelMetadataHelperService } from "src/helpers/model-metadata-helper.service";
import { FieldMetadataRepository } from "src/repository/field-metadata.repository";
import { ModelMetadataRepository } from "src/repository/model-metadata.repository";

@Injectable()
export class SystemFieldsSeederService {
  // This service is responsible for seeding the system fields metadata for all models.
  // It will check if the system fields are already present in the field-metadata table.
  // If not, it will add them.
  constructor(
    private readonly modelHelperService: ModelMetadataHelperService,
    //   @InjectRepository(ModelMetadata)
    //   private readonly modelRepository: Repository<ModelMetadata>, // Replace with actual model repository type
    private readonly modelRepository: ModelMetadataRepository, // Replace with actual model repository type
    private readonly fieldMetadataRepository: FieldMetadataRepository, // Replace with actual field repository type
  ) { }

  async seed() {
    // Get the model repo
    const models = await this.modelRepository.find({
      relations: ['fields'], // Assuming 'fields' is the relation to field metadata
    });

    for (const model of models) {
      // Check if the system fields are already present
      await this.seedMissingSystemFields(model);
    }
  }

  private async seedMissingSystemFields(model: ModelMetadata) {
    const existingSystemFields = model.fields.filter(field => field.isSystem);
    const systemFieldsMetadata = this.modelHelperService.getSystemFieldsMetadata(model.isLegacyTable, model.isLegacyTableWithId);

    // Find out which system fields are missing
    const missingFields = systemFieldsMetadata.filter(
      sysField => !existingSystemFields.some(field => field.name === sysField.name)
    );

    // If there are missing fields, add them
    if (missingFields.length > 0) {
      const newFields = missingFields.map(field => ({
        ...field,
        model: model, // Associate the field with the current model
      }));
      await this.fieldMetadataRepository.save(newFields);
    }
  }
}
