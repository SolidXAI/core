import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface IntFieldOptions {
    min: number | undefined | null;
    max: number | undefined | null;
    required: boolean | undefined | null;
}
export declare class IntFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(createDto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(createDto: any): any;
    private isApplyMinValidation;
    private isApplyMaxValidation;
    private isApplyRequiredValidation;
}
