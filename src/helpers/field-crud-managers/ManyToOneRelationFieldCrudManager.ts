import { classify } from "@angular-devkit/core/src/utils/strings";
import { isEmpty, isNotEmpty, isString } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { IsParsableInt } from "src/validators/is-parsable-int";
import { EntityManager } from "typeorm";

export interface ManyToOneRelationFieldOptions {
    // Add options for relation field
    required: boolean | undefined | null;
    relationCoModelSingularName: string | undefined | null;
    fieldName: string | undefined | null;
    // modelUserKeyFieldName: string | undefined | null;
    modelSingularName: string | undefined | null;
    entityManager: EntityManager;
    relationCoModelUserKeyFieldName: string | undefined | null; 
}

// This implementation is meant to be used for many-to-one relation field
export class ManyToOneRelationFieldCrudManager implements FieldCrudManager {
    private idFieldName: string;
    private userKeyFieldName: string;
    constructor(private readonly options: ManyToOneRelationFieldOptions) {
        // this.options = options;
        this.idFieldName = `${options.fieldName}Id`;
        this.userKeyFieldName = `${options.fieldName}UserKey`;
    }
    validate(dto: any) {
        const fieldId: number = dto[this.idFieldName];
        const fieldUserKey: string = dto[this.userKeyFieldName];
        return this.applyValidations(fieldId, fieldUserKey);
    }

    private applyValidations(fieldId: any, fieldUserKey: string): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldId) && isEmpty(fieldUserKey) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required. Either pass ${this.idFieldName} or ${this.userKeyFieldName}.` }) : "no errors";
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
        !IsParsableInt(fieldId) ? errors.push({ field: this.options.fieldName, error: 'Field is not a integer' }) : "no errors";
        return errors;
    }

    private applyUserKeyFormatValidations(fieldUserKey: string): ValidationError[] {
        const errors: ValidationError[] = [];
        !isString(fieldUserKey) ? errors.push({ field: this.options.fieldName, error: 'Field is not a string' }) : "no errors";
        if (isEmpty(this.options.relationCoModelUserKeyFieldName)) {
            errors.push({ field: this.options.fieldName, error: `UserKey field name is not defined in the model ${this.options.relationCoModelSingularName}` });
        }
        return errors;
    }

    async transformForCreate(dto: any): Promise<any> {
        const fieldId: number = dto[this.idFieldName];
        const fieldUserKeyValue: string = dto[this.userKeyFieldName];

        // Avoid transforming if both fieldId and fieldUserKey  is empty
        if ((isEmpty(fieldId)) && isEmpty(fieldUserKeyValue)) return dto;

        // // Load the related entity from the database, using the repository of the related entity
        const entityTarget = this.getRelatedEntityTarget(classify(this.options.relationCoModelSingularName));
        if (isNotEmpty(fieldId)) {
            dto[this.options.fieldName] = await this.options.entityManager.getRepository(entityTarget).findOneBy({ id: fieldId });
            if (this.options.required && isEmpty(dto[this.options.fieldName])) {
                throw new Error(`ManyToOneRelationFieldCrudManager: Record with id: ${fieldId} not found in ${this.options.relationCoModelSingularName}`);
            }
        }
        else {
            dto[this.options.fieldName] = await this.options.entityManager.getRepository(entityTarget).findOneBy({ [this.options.relationCoModelUserKeyFieldName]: fieldUserKeyValue });
            if (this.options.required && isEmpty(dto[this.options.fieldName])) {
                throw new Error(`ManyToOneRelationFieldCrudManager: Record with userKey: ${this.options.relationCoModelUserKeyFieldName}: ${fieldUserKeyValue} not found in ${this.options.relationCoModelSingularName}`);
            }
        }


        return dto;
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }

    // Returns the entity target class from the entity name
    private getRelatedEntityTarget(relatedEntityName: string): any {
        const entityMetadatas = this.options.entityManager.connection.entityMetadatas;
        const relatedEntityMetadata = entityMetadatas.find(em => em.name === relatedEntityName);
        return relatedEntityMetadata.target;
    }

}