import { Injectable } from "@nestjs/common";
import { IEntityPreComputeFieldProvider } from "../../../interfaces";
import { kebabCase } from "lodash";
import { CommonEntity } from 'src/entities/common.entity';
import { ComputedFieldMetadata } from 'src/helpers/solid-registry';

// @ComputedFieldProvider()
@Injectable()
// export class ConcatComputedFieldProvider implements IComputedFieldProvider<any> {
export class NewConcatComputedFieldProvider implements IEntityPreComputeFieldProvider<CommonEntity, any, string> {
    preComputeValue(triggerEntity: CommonEntity, computedFieldMetadata: ComputedFieldMetadata<any>): Promise<string> {
        throw new Error('Method not implemented.');
    }
    name(): string {
        return "ConcatComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to create fields whose value is a concatenation of other fields in the same model.";
    }

    valueType(): string {
        return "string";
    }

    async computeValue(dto: any, ctxt: any): Promise<string> {
        const separator = ctxt.separator;
        const fields = ctxt.fields;
        const slugify = ctxt.slugify || false;

        if (!Array.isArray(fields) || fields?.length === 0) {
            return '';
        }
        let concatenatedString = '';
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            // if slugify then each field val to be converted to a slug before concatenation
            let fieldVal = dto[field];
            if (slugify) {
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