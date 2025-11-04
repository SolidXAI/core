import { v4 as uuidv4 } from "uuid";
import { Injectable } from "@nestjs/common";
import { IEntityPreComputeFieldProvider } from "../../../interfaces";
import { CommonEntity } from "src/entities/common.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";

@ComputedFieldProvider()
@Injectable()
export class UuidExternalIdEntityComputedFieldProvider
  implements IEntityPreComputeFieldProvider<CommonEntity, any, string>
{
  name(): string {
    return "UuidExternalIdEntityComputedFieldProvider";
  }

  help(): string {
    return "Computed field provider used to compute the external id field as a UUID.";
  }

  valueType(): string {
    return "string";
  }

  async preComputeValue(
    triggerEntity: CommonEntity,
    computedFieldMetadata: ComputedFieldMetadata<any>
  ): Promise<string> {
    const { computedFieldValueProviderCtxt } = computedFieldMetadata;
    const prefix = computedFieldValueProviderCtxt?.prefix ?? "";
    const generated = `${prefix}-${uuidv4()}`;
    return generated;
  }
}
