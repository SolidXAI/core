import { isDate, isEmpty, isNotEmpty } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface DateFieldOptions {
    required: boolean | undefined | null;
    fieldName: string;
}

export class DateFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: DateFieldOptions) {
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
        !isDate(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not a date' }) : "no errors";
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
