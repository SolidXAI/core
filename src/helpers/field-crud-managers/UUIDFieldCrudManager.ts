import { isEmpty, isNotEmpty, matches } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { v4 as uuidv4 } from 'uuid';


const UUID_REGEX = `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`;

export interface UUIDFieldOptions {
    fieldName: string;
}

//TODO Do we want to provide option to generate uuid of a particular length?
export class UUIDFieldCrudManager implements FieldCrudManager {
    constructor(private readonly options: UUIDFieldOptions) { }

    validate(dto: any): ValidationError[] {
        const fieldValue: any = dto[this.options.fieldName];
        return this.applyValidations(fieldValue);
    }

    private applyValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any): ValidationError[] {
        const errors: ValidationError[] = [];
        !this.isUUID(fieldValue) ? errors.push({ field: this.options.fieldName, error: `${this.options.fieldName} is not a valid UUID` }) : "no errors";
        return errors;
    }

    transformForCreate(dto: any): any {
        const fieldValue: any = dto[this.options.fieldName];
        if (isEmpty(fieldValue)) dto[this.options.fieldName] = this.generateUUID(); 
        return dto;
    }

    // Validation to be applied
    private isUUID(fieldValue: string): boolean {
        return matches(fieldValue, new RegExp(UUID_REGEX));
    }
    private generateUUID(): string {
        return uuidv4();
    }

}