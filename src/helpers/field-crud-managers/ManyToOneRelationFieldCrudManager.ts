import { classify } from "@angular-devkit/core/src/utils/strings";
import { isEmpty, isNotEmpty, isString } from "class-validator";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { IsParsableInt } from "src/validators/is-parsable-int";
import { EntityManager } from "typeorm";

interface ManyToOneRelationFieldOptions {
    // Add options for relation field
    required: boolean | undefined | null;
    relationModelSingularName: string | undefined | null;
    idFieldName: string | undefined | null;
    userKeyFieldName: string | undefined | null;
    userKeyName: string | undefined | null;
}

// This implementation is meant to be used for many-to-one relation field
export class ManyToOneRelationFieldCrudManager implements FieldCrudManager {
    private options: ManyToOneRelationFieldOptions;
    constructor(readonly fieldMetadata: FieldMetadata, readonly entityManager: EntityManager) {
        this.options = { 
            required: fieldMetadata.required,
            relationModelSingularName: fieldMetadata.relationModelSingularName,
            userKeyName: fieldMetadata.model?.userKeyField?.name,
            idFieldName: `${fieldMetadata.name}Id`,
            userKeyFieldName: `${fieldMetadata.name}UserKey`
        };
    }
    validate(dto: any) {
        const fieldId: number = dto[this.options.idFieldName];
        const fieldUserKey: string = dto[this.options.userKeyFieldName];
        return this.applyValidations(fieldId, fieldUserKey);
    }

    private applyValidations(fieldId: any, fieldUserKey: string): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldId) && isEmpty(fieldUserKey) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required. Either pass ${this.options.idFieldName} or ${this.options.userKeyFieldName}.` }) : "no errors";
        if (isNotEmpty(fieldId)) {
            errors.push(...this.applyIdFormatValidations(fieldId));
        }
        if (isNotEmpty(fieldUserKey)) {
            errors.push(...this.applyUserKeyFormatValidations(fieldUserKey));
        }
        return errors;
    }

    private applyIdFormatValidations(fieldId: any): ValidationError[] { //FIXME fieldId is any because it can be string or number. Keeping it any for compatibility with isParsableInt. 
        const errors: ValidationError[] = [];
        !IsParsableInt(fieldId) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a integer' }) : "no errors";
        return errors;
    }

    private applyUserKeyFormatValidations(fieldUserKey: string): ValidationError[] {
        const errors: ValidationError[] = [];
        !isString(fieldUserKey) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a string' }) : "no errors";
        if (isEmpty(this.options.userKeyName)) {
            errors.push({ field: this.fieldMetadata.name, error: `UserKey field name is not defined in the model ${this.fieldMetadata.model.singularName}` });
        }
        return errors;
    }

    async transformForCreate(dto: any): Promise<any> {
        const fieldId: number = dto[this.options.idFieldName];
        const fieldUserKey: string = dto[this.options.userKeyFieldName];

        // Avoid transforming if both fieldId and fieldUserKey  is empty
        if ((isEmpty(fieldId)) && isEmpty(fieldUserKey)) return dto;

        // // Load the related entity from the database, using the repository of the related entity
        const entityTarget = this.getRelatedEntityTarget(classify(this.options.relationModelSingularName));
        if (isNotEmpty(fieldId)) {
            dto[this.fieldMetadata.name] = await this.entityManager.getRepository(entityTarget).findOneBy({ id: fieldId });
        }
        else {
            dto[this.fieldMetadata.name] = await this.entityManager.getRepository(entityTarget).findOneBy({ [this.options.userKeyName]: fieldUserKey });
        }

        return dto;
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }

    // Returns the entity target class from the entity name
    private getRelatedEntityTarget(relatedEntityName: string): any {
        const entityMetadatas = this.entityManager.connection.entityMetadatas;
        const relatedEntityMetadata = entityMetadatas.find(em => em.name === relatedEntityName);
        return relatedEntityMetadata.target;
    }

}