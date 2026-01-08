import { isEmpty, isNotEmpty, max, min } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface BigIntFieldOptions {
    min: number | undefined | null; // FIXME Do we want to support min and max for bigint? or number should suffice?
    max: number | undefined | null; // FIXME Do we want to support min and max for bigint? or number should suffice?
    required: boolean | undefined | null;
    fieldName: string;
}

export class BigIntFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: BigIntFieldOptions) {
    }

    validate(createDto: any): ValidationError[] {
        let fieldValue: any = createDto[this.options.fieldName];
        if (fieldValue !== undefined && fieldValue !== null) {
            try {
                if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
                    fieldValue = BigInt(fieldValue);
                }
            } catch (err) {
                return [{ field: this.options.fieldName, error: 'Invalid numeric value' }];
            }
        }
        return this.applyValidations(fieldValue);
    }

    private applyValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required` }) : "no errors";
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        !this.isBigInt(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not a bigint' }) : "no errors";
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

    private isBigInt(value: any): boolean {
        const valueType = typeof value;
        return valueType === 'bigint' || (valueType === 'number' && Number.isFinite(value));
    }
}
