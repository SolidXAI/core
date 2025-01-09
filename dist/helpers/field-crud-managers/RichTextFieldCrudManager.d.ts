import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface RichTextFieldOptions {
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
}
export declare class RichTextFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): any;
    private isApplyStringValidation;
    private isApplyRegexValidation;
    private isApplyRequiredValidation;
}
