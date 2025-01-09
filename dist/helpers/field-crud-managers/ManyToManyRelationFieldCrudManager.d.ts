import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EntityManager } from "typeorm";
export declare class ManyToManyRelationFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    readonly entityManager: EntityManager;
    readonly isInverseSide: boolean;
    private options;
    private readonly logger;
    constructor(fieldMetadata: FieldMetadata, entityManager: EntityManager, isInverseSide: boolean);
    validate(dto: any): ValidationError[];
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): Promise<any>;
    private transformByCommand;
    private transformForCommandClear;
    private transformForCommandSet;
    private tranformForCommandLink;
    private transformForCommandUnLink;
    private transformForCommandCreate;
    private transformForCommandUpdate;
    private transformForCommandDelete;
    private isApplyRequiredValidation;
    private getEntityTarget;
}
