import { Injectable } from "@nestjs/common";
import { kebabCase, get } from "lodash";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { CommonEntity } from "src/entities/common.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";


export interface ConcatComputedFieldContext {
    separator: string; // The separator to use between concatenated values
    fields: string[]; // The fields to concatenate
    slugify?: boolean; // Optional: if true, slugify each field value before concatenation
}

@ComputedFieldProvider()
@Injectable()
export class ConcatEntityComputedFieldProvider<T extends CommonEntity> implements IEntityPreComputeFieldProvider<T, ConcatComputedFieldContext> {

    name(): string {
        return "ConcatEntityComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to create fields whose value is a concatenation of other fields in the same model.";
    }

    async preComputeValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<ConcatComputedFieldContext>) {
        const { computedFieldValueProviderCtxt } = computedFieldMetadata;
        const separator = computedFieldValueProviderCtxt.separator ?? ' ';
        const fields: string[] = computedFieldValueProviderCtxt.fields ?? [];
        const slugify = computedFieldValueProviderCtxt.slugify ?? false;

        const parts: string[] = [];

        for (const fieldExpr of fields) {
            let val = get(triggerEntity as any, fieldExpr);

            // normalize to string (skip null/undefined)
            if (val == null) continue;

            if (typeof val !== 'string') {
                val = String(val);
            }

            if (slugify) {
                val = kebabCase(val);
            }

            // ignore empty strings so you don't get stray separators
            if (val.length > 0) {
                parts.push(val);
            }
        }

        const concatenatedString = parts.join(separator);

        // set the computed field on the entity
        (triggerEntity as any)[computedFieldMetadata.fieldName] = concatenatedString;
    }

}