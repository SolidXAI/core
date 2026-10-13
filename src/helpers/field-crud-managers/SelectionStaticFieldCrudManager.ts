import { isEmpty, isInt, isNotEmpty, isString } from "class-validator";
import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface SelectionStaticFieldOptions {
    selectionStaticValues: string[];
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
    fieldName: string;
    isMultiSelect: boolean | undefined | null;
}

export class SelectionStaticFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: SelectionStaticFieldOptions) {
    }

    async validate(dto: any): Promise<ValidationError[]> {
        const fieldValue: any = dto[this.options.fieldName];
        // return this.applyValidations(fieldValue);
        const isMultiSelect = this.options?.isMultiSelect;
        if (isMultiSelect && fieldValue) {
            const arrayCheck = this.parseAndValidateArray(fieldValue);

            if (!arrayCheck.isValid) {
                return [
                    {
                        field: this.options.fieldName,
                        error: `Field: ${this.options.fieldName} must be a valid string representation of a JSON array of selection values. Allowed values: '${this.formatAllowedValues()}'. Received: ${this.formatValue(fieldValue)}`,
                    },
                ];
            }

            const values = arrayCheck.values;

            if (this.isApplyRequiredValidation() && values.length === 0) {
                return [
                    {
                        field: this.options.fieldName,
                        error: `Field: ${this.options.fieldName} is required`,
                    },
                ];
            }

            // Apply validations to each value
            const allErrors = await Promise.all(values.map((val) => this.applyValidations(val, values)));
            return allErrors.flat();
        } else {
            // For non-multi-select, apply validations to the single field value
            return this.applyValidations(fieldValue);
        }
    }

    private parseAndValidateArray(fieldValue: any): { isValid: boolean; values: any[] } {
        if (Array.isArray(fieldValue)) {
            return { isValid: true, values: fieldValue };
        }
    
        try {
            const parsed = typeof fieldValue === 'string' ? JSON.parse(fieldValue) : null;
            if (Array.isArray(parsed)) {
                return { isValid: true, values: parsed };
            }
        } catch {
            // fall through
        }
    
        return { isValid: false, values: [] };
    }
    

    private applyValidations(fieldValue: any, receivedValue: any = fieldValue): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required` }) : "no errors";
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue, receivedValue));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any, receivedValue: any = fieldValue): ValidationError[] {
        const errors: ValidationError[] = [];
        const allowedValues = this.formatAllowedValues();
        const received = this.formatValue(receivedValue);
        !this.isValidSelectionValueType(fieldValue, this.options.selectionValueType) ? errors.push({
            field: this.options.fieldName,
            error: `Field: ${this.options.fieldName} has an invalid selection value type. Expected ${this.options.selectionValueType}. Allowed values: ${allowedValues}. Received: ${received}`,
        }) : "no errors";
        !this.isValidSelectionStaticValue(fieldValue, this.options.selectionValueType, this.options.selectionStaticValues) ? errors.push({
            field: this.options.fieldName,
            error: `Field: ${this.options.fieldName} contains an invalid selection value. Allowed values: ${allowedValues}. Received: ${received}`,
        }) : "no errors";
        return errors;
    }

    private formatAllowedValues(): string {
        const values = this.options.selectionStaticValues.map((value) => {
            const rawValue = value.split(":")[0];
            return this.options.selectionValueType === SelectionValueType.int ? Number(rawValue) : rawValue;
        });
        return this.formatValue(values);
    }

    private formatValue(value: any): string {
        try {
            const formatted = JSON.stringify(value);
            return formatted === undefined ? String(value) : formatted;
        } catch {
            return String(value);
        }
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
    private isValidSelectionValueType(fieldValue: any, selectionValueType: SelectionValueType): boolean {
        switch (selectionValueType) {
            case SelectionValueType.string:
                return isString(fieldValue);
            case SelectionValueType.int:
                return isInt(fieldValue);
            default:
                throw new Error(`Validation for selection value type ${selectionValueType} is not implemented`);
        }
    }

    private isValidSelectionStaticValue(fieldValue: any, selectionValueType: any, selectionStaticValues: string[]): boolean {
        switch (selectionValueType) {
            case SelectionValueType.string:
                return selectionStaticValues.map(v => v.split(":")[0]).includes(fieldValue);
            case SelectionValueType.int:
                return selectionStaticValues.map(v => Number(v.split(":")[0])).includes(fieldValue);
            default:
                throw new Error(`Validation for selection value type ${selectionValueType} is not implemented`);
        }
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
