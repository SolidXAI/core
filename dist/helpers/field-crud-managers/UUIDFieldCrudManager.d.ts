import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export declare class UUIDFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): any;
    private isUUID;
    private generateUUID;
}
