import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@nestjs/common";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { IComputedFieldProvider } from "../../interfaces";
import { kebabCase } from "lodash";

// @ComputedFieldProvider()
@Injectable()
export class ConcatComputedFieldProvider implements IComputedFieldProvider<any> {

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