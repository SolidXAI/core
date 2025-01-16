import { isEmail, isEmpty, isNotEmpty, matches } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export const MAX_EMAIL_LENGTH = 254;

export interface EmailFieldOptions {
    max: number | undefined | null;
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
    fieldName: string;
}

export class EmailFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: EmailFieldOptions) {
    }

    validate(dto: any): ValidationError[] {
        const fieldValue: any = dto[this.options.fieldName];
        return this.applyValidations(fieldValue);
    }

    private applyValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required` }): "no errors";
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        !isEmail(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not an email' }): "no errors";
        this.isApplyMaxValidation() && fieldValue.length > this.options.max ? errors.push({ field: this.options.fieldName, error: 'Field is greater than max length' }) : "no errors";
        this.isApplyRegexValidation() && !matches(fieldValue, new RegExp(this.options.regexPattern)) ? errors.push({ field: this.options.fieldName, error: 'Field does not match regex pattern' }): "no errors";
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
