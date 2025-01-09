import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EntityManager } from "typeorm";
export declare class ManyToOneRelationFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    readonly entityManager: EntityManager;
    private options;
    constructor(fieldMetadata: FieldMetadata, entityManager: EntityManager);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyIdFormatValidations;
    private applyUserKeyFormatValidations;
    transformForCreate(dto: any): Promise<any>;
    private isApplyRequiredValidation;
    private getRelatedEntityTarget;
}
