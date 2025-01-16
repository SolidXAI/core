import { isEmpty, isNotEmpty, isString, length, matches } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface ShortTextFieldOptions {
    length: number | undefined | null;
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
    fieldName: string;
}

export class ShortTextFieldCrudManager implements FieldCrudManager {
    private options: ShortTextFieldOptions;

    constructor(options: ShortTextFieldOptions) {
        this.options = options;
    }

    validate(dto: any,  _files:Array<Express.Multer.File>): ValidationError[] {
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
        this.isApplyLengthValidation() && !length(fieldValue, 1, this.options.length) ? errors.push({ field: this.options.fieldName, error: 'Field length is invalid' }) : "no errors"; //FIXME min length to be handled
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
    private isApplyLengthValidation(): boolean {
        return (this.options.length > 0);
    }
    private isApplyRegexValidation(): boolean {
        return this.options.regexPattern !== null && this.options.regexPattern !== undefined && this.options.regexPattern.trim().length > 0;
    }
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}