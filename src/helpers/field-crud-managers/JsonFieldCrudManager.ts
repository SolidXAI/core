import { isEmpty, isJSON, isNotEmpty, isString, length, matches } from "class-validator";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface JsonFieldOptions {
    required: boolean | undefined | null;
}

export class JsonFieldCrudManager implements FieldCrudManager {
    private options: JsonFieldOptions;

    constructor(readonly fieldMetadata: FieldMetadata) {
        this.options = { required: fieldMetadata.required };
    }

    validate(dto: any): ValidationError[] {
        const fieldValue: any = dto[this.fieldMetadata.name];
        return this.applyValidations(fieldValue);
    }

    private applyValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }): "no errors";
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        !isJSON(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a json object' }) : "no errors";
        return errors;
    }

    transformForCreate(createDto: any): any {
        return createDto;
    }

    // Validation to be applied
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
