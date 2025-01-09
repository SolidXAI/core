import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface SelectionStaticFieldOptions {
    selectionStaticValues: string[];
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
}
export declare class SelectionStaticFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): any;
    private isValidSelectionValueType;
    private isValidSelectionStaticValue;
    private isApplyRequiredValidation;
}
