import { BadRequestException, Injectable } from "@nestjs/common";
import { isNotEmpty, matches } from "class-validator";
import { ModelMetadataService } from "./model-metadata.service";

@Injectable()
export class MetadataValidationService {
  constructor(
    private readonly modelMetadataService: ModelMetadataService,
  ) {}

  async validateCreateDto(
    modelName: string,
    dto: object,
  ): Promise<void> {
    const model = await this.modelMetadataService.findOneBySingularName(
      modelName,
      { fields: true },
    );

    for (const field of model.fields ?? []) {
      const value = (dto as Record<string, unknown>)[field.name];

      if (!isNotEmpty(value) || typeof value !== "string") {
        continue;
      }

      if (!isNotEmpty(field.regexPattern)) {
        continue;
      }

      if (!matches(value, new RegExp(field.regexPattern))) {
        throw new BadRequestException(
          field.regexPatternNotMatchingErrorMsg ||
            `Validation errors in ${field.name} is invalid i.e Field regex pattern is invalid`,
        );
      }
    }
  }
}
