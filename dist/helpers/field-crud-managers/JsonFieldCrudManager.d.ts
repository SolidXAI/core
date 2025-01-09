import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface JsonFieldOptions {
    required: boolean | undefined | null;
}
export declare class JsonFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(createDto: any): any;
    private isApplyRequiredValidation;
}
