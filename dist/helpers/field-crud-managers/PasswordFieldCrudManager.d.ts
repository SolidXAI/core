import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface PasswordFieldOptions {
    min: number | undefined | null;
    max: number | undefined | null;
    required: boolean | undefined | null;
    regexPattern: string | undefined | null;
}
export declare class PasswordFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    private hashingService;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): Promise<any>;
    private isApplyMinValidation;
    private isApplyMaxValidation;
    private isPasswordValid;
    private isConfirmPasswordValid;
    private isApplyRequiredValidation;
}
