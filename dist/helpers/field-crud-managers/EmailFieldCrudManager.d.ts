import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export declare const MAX_EMAIL_LENGTH = 254;
export interface EmailFieldOptions {
    max: number | undefined | null;
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
}
export declare class EmailFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): any;
    private isApplyRequiredValidation;
    private isApplyMaxValidation;
    private isApplyRegexValidation;
}
