import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface ShortTextFieldOptions {
    length: number | undefined | null;
    regexPattern: string | undefined | null;
    required: boolean | undefined | null;
}
export declare class ShortTextFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any, _files: Array<Express.Multer.File>): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): any;
    private isApplyStringValidation;
    private isApplyLengthValidation;
    private isApplyRegexValidation;
    private isApplyRequiredValidation;
}
