import { Injectable } from "@nestjs/common";
import { kebabCase, get } from "lodash";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { CommonEntity } from "src/entities/common.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";


export interface SequenceNumComputedFieldContext {
    sequenceName: string; // The separator to use between concatenated values
}

@ComputedFieldProvider()
@Injectable()
export class SequenceNumComputedFieldProvider<T extends CommonEntity> implements IEntityPreComputeFieldProvider<T, SequenceNumComputedFieldContext> {

    name(): string {
        return "SequenceNumComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to create fields whose value is based on some prefix, padding & sequence number.";
    }

    async preComputeValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<SequenceNumComputedFieldContext>) {
        const { computedFieldValueProviderCtxt } = computedFieldMetadata;
        const { sequenceName } = computedFieldValueProviderCtxt;


        const concatenatedString = "";

        // set the computed field on the entity
        (triggerEntity as any)[computedFieldMetadata.fieldName] = concatenatedString;
    }

}