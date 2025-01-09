import { isEmpty, isNotEmpty, isEmail, matches } from "class-validator";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export const MAX_EMAIL_LENGTH = 254;

export interface EmailFieldOptions {
    max: number | undefined | null;
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
}

export class EmailFieldCrudManager implements FieldCrudManager {
    private options: EmailFieldOptions;

    constructor(readonly fieldMetadata: FieldMetadata) {
        this.options = { required: fieldMetadata.required, max: fieldMetadata.max ?? MAX_EMAIL_LENGTH, regexPattern: fieldMetadata.regexPattern };
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
        !isEmail(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not an email' }): "no errors";
        this.isApplyMaxValidation() && fieldValue.length > this.options.max ? errors.push({ field: this.fieldMetadata.name, error: 'Field is greater than max length' }) : "no errors";
        this.isApplyRegexValidation() && !matches(fieldValue, new RegExp(this.options.regexPattern)) ? errors.push({ field: this.fieldMetadata.name, error: 'Field does not match regex pattern' }): "no errors";
        return errors;
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
    private isApplyMaxValidation(): boolean {
        return (this.options.max > 0);
    }
    private isApplyRegexValidation(): boolean {
        return isNotEmpty(this.options.regexPattern);
    }
}
