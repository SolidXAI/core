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
        if (typeof fieldValue === 'string') {
            const date = new Date(fieldValue);
            if (isNaN(date.getTime())) {
                errors.push({ field: this.options.fieldName, error: 'Field is not a valid date string' });
            }
        } else if (!isDate(fieldValue)) {
            errors.push({ field: this.options.fieldName, error: 'Field is not a date' });
        }
        return errors;
    }

    transformForCreate(dto: any): any {
        const fieldValue = dto[this.options.fieldName];
        if (typeof fieldValue === 'string') {
            const date = new Date(fieldValue);
            if (!isNaN(date.getTime())) {
                dto[this.options.fieldName] = date;
            }
        }
        return dto;
    }

    // Validation to be applied
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
