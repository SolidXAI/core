import { isDate, isEmpty, isNotEmpty } from "class-validator";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface DateFieldOptions {
    // min: number | undefined | null; 
    // max: number | undefined | null;
    required: boolean | undefined | null;
}

export class DateFieldCrudManager implements FieldCrudManager {
    private options: DateFieldOptions;

    constructor(readonly fieldMetadata: FieldMetadata) {
        this.options = {    
            required: fieldMetadata.required,
            // min: fieldMetadata.min,
            // max: fieldMetadata.max
        };
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
        !isDate(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a date' }) : "no errors";
        // this.isApplyMinValidation() && fieldValue.length >= this.options.min ? null : errors.push({ field: this.fieldMetadata.name, error: 'Date is less than min date' });
        // this.isApplyMaxValidation() && fieldValue.length <= this.options.max ? null : errors.push({ field: this.fieldMetadata.name, error: 'Date is greater than max date' });
        return errors;
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
    // private isApplyMinValidation(): boolean {
    //     return (this.options.min !== undefined && this.options.min !== null);
    // }
    // private isApplyMaxValidation(): boolean {
    //     return (this.options.max !== undefined && this.options.max !== null);
    // }
}
