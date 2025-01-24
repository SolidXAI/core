import { isEmpty, isNotEmpty, isString, matches } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface RichTextFieldOptions {
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
    fieldName: string | undefined | null;
}

export class RichTextFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: RichTextFieldOptions) {
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
        this.isApplyStringValidation() && !isString(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not a string' }) : "no errors";
        this.isApplyRegexValidation() && !matches(fieldValue, new RegExp(this.options.regexPattern)) ? errors.push({ field: this.options.fieldName, error: 'Field regex pattern is invalid' }) : "no errors";
        return errors;
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
    private isApplyStringValidation(): boolean {
        return true;
    }
    private isApplyRegexValidation(): boolean {
        return this.options.regexPattern !== null && this.options.regexPattern !== undefined && this.options.regexPattern.trim().length > 0;
    }
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
