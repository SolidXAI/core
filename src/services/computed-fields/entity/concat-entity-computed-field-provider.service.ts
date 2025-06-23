import { Injectable } from "@nestjs/common";
import { kebabCase } from "lodash";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { BaseEntityComputedFieldProvider } from "./base-entity-computed-field-provider";
import { CommonEntity } from "src/entities/common.entity";


export interface ConcatComputedFieldContext {
    separator: string; // The separator to use between concatenated values
    fields: string[]; // The fields to concatenate
    slugify?: boolean; // Optional: if true, slugify each field value before concatenation
}

@ComputedFieldProvider()
@Injectable()
export class ConcatEntityComputedFieldProvider<T extends CommonEntity> extends BaseEntityComputedFieldProvider<T, ConcatComputedFieldContext, string> {

    name(): string {
        return "ConcatEntityComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to create fields whose value is a concatenation of other fields in the same model.";
    }

    async computeValue(entity: T, computedFieldContext: ConcatComputedFieldContext): Promise<string> {
        const separator = computedFieldContext.separator || ' '; // Default to space if no separator is provided
        const fields = computedFieldContext.fields || [];
        const slugify = computedFieldContext.slugify || false;

        let concatenatedString = '';
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            // if slugify then each field val to be converted to a slug before concatenation
            let fieldVal = entity[field];
            if (slugify && typeof fieldVal === 'string') {
                fieldVal = kebabCase(fieldVal);
            }

            if (concatenatedString) {
                concatenatedString += separator;
            }
            concatenatedString += fieldVal;
        }

        return concatenatedString;
    }

}