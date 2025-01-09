import { isBoolean, isEmpty, isNotEmpty } from "class-validator";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface BooleanFieldOptions {
    required: boolean | undefined | null;
}

export class BooleanFieldCrudManager implements FieldCrudManager {
    private options: BooleanFieldOptions;

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
        !isBoolean(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is not a boolean value` }): "no errors";
        return errors;
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
