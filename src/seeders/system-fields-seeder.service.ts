// This class will add the system fields in the field-metadata table if they are missing.
// Fetch all the models and their fields metadata and check if the system fields are present.

import { InjectRepository } from "@nestjs/typeorm";
import { ModelMetadata } from "src/entities/model-metadata.entity";
import { ModelMetadataHelperService } from "src/helpers/model-metadata-helper.service";
import { FieldRepository } from "src/repository/field.repository";
import { Repository } from "typeorm";

export class SystemFieldsSeederService {
   // This service is responsible for seeding the system fields metadata for all models.
   // It will check if the system fields are already present in the field-metadata table.
   // If not, it will add them.
   constructor(
      private readonly modelHelperService: ModelMetadataHelperService,
      @InjectRepository(ModelMetadata)
      private readonly modelRepository: Repository<ModelMetadata>, // Replace with actual model repository type
      @InjectRepository(FieldRepository)
      private readonly fieldRepository: Repository<FieldRepository>, // Replace with actual field repository type
   ) {}
  
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
        const systemFieldsMetadata = this.modelHelperService.getSystemFieldsMetadata();

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
            await this.fieldRepository.save(newFields);
        }
    }
}
   