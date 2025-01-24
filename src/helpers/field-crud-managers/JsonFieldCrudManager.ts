import { isEmpty, isJSON, isNotEmpty } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";

export interface JsonFieldOptions {
    required: boolean | undefined | null;
    fieldName: string | undefined | null;
}

export class JsonFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: JsonFieldOptions) {
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
        !isJSON(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not a json object' }) : "no errors";
        return errors;
    }

    transformForCreate(createDto: any): any {
        return createDto;
    }

    // Validation to be applied
    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}
