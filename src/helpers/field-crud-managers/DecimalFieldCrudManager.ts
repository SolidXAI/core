import { isEmpty, isNotEmpty, isNumber, max, min } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface DecimalFieldOptions {
    min: number | undefined | null;
    max: number | undefined | null;
    required: boolean | undefined | null;
    fieldName: string;
}

export class DecimalFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: DecimalFieldOptions) {
    }

    validate(createDto: any): ValidationError[] {
        const fieldValue: any = createDto[this.options.fieldName];
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
        !isNumber(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not a decimal' }): "no errors";
        this.isApplyMinValidation() && !min(fieldValue, this.options.min) ? errors.push({ field: this.options.fieldName, error: 'Field value is lesser than minimum required' }) : "no errors"; //FIXME min length to be handled
        this.isApplyMaxValidation() && !max(fieldValue, this.options.max) ? errors.push({ field: this.options.fieldName, error: 'Field value is greater than maximum required' }) : "no errors";
        return errors;
    }

    transformForCreate(createDto: any): any {
        return createDto;
    }

    // Validation to be applied
    private isApplyMinValidation(): boolean {
        return this.options.min > 0;
    }
    private isApplyMaxValidation(): boolean {
        return this.options.max > 0;
    }
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
