import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager } from "src/interfaces";
export declare class NoOpsFieldCrudManager implements FieldCrudManager {
    fieldMetadata: FieldMetadata;
    createDto: any;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any): any[];
    transformForCreate(dto: any): any;
}
