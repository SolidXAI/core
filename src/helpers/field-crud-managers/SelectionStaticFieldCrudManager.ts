import { isEmpty, isInt, isNotEmpty, isString } from "class-validator";
import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface SelectionStaticFieldOptions {
    selectionStaticValues: string[];
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
    fieldName: string;
}

export class SelectionStaticFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: SelectionStaticFieldOptions) {
    }

    validate(dto: any): ValidationError[] {
        const fieldValue: any = dto[this.options.fieldName];
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
        !this.isValidSelectionValueType(fieldValue, this.options.selectionValueType) ? errors.push({ field: this.options.fieldName, error: 'Field value is invalid' }) : "no errors";
        !this.isValidSelectionStaticValue(fieldValue, this.options.selectionValueType, this.options.selectionStaticValues) ? errors.push({ field: this.options.fieldName, error: 'Field value is invalid' }) : "no errors";
        return errors;
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
