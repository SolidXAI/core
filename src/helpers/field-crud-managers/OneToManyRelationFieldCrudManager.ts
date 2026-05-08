import { classify } from '../string.helper';
import { Logger } from "@nestjs/common";
import { isEmpty, isEnum, isInt, isNotEmpty } from "class-validator";
import { RelationFieldsCommand } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EntityManager, In } from "typeorm";

export interface OneToManyRelationFieldOptions {
    // Add options for relation field
    required: boolean | undefined | null;
    relationCoModelSingularName: string | undefined | null;
    inverseRelationCoModelFieldName: string | undefined | null;
    modelSingularName: string | undefined | null;
    inverseFieldName: string | undefined | null;
    entityManager: EntityManager | undefined | null;
    isUpdate?: boolean;
    entityId?: number;
}

const linkCommands = [RelationFieldsCommand.link, RelationFieldsCommand.unlink, RelationFieldsCommand.set];

// This implementation is meant to be used for many-to-one relation field
export class OneToManyRelationFieldCrudManager implements FieldCrudManager {
    private readonly logger = new Logger(OneToManyRelationFieldCrudManager.name);

    private readonly valueFieldName: string;
    private readonly idFieldName: string;
    private readonly commandFieldName: string;

    constructor(private readonly options: OneToManyRelationFieldOptions) {
        this.valueFieldName = this.options.inverseRelationCoModelFieldName ?? `${this.options.relationCoModelSingularName}s`;
        this.idFieldName = `${this.options.inverseRelationCoModelFieldName ?? this.options.relationCoModelSingularName}Ids`;
        this.commandFieldName = `${this.options.inverseRelationCoModelFieldName ?? this.options.relationCoModelSingularName}Command`;
    }

    validate(dto: any) {
        return this.applyValidations(dto);
    }

    private applyValidations(dto: any): ValidationError[] { 
        const errors: ValidationError[] = [];

        const commandFieldName = this.commandFieldName;
        const commandValue = dto[commandFieldName];
        this.isApplyRequiredValidation() && isEmpty(commandValue) ? errors.push({ field: commandFieldName, error: 'Command field is  required' }) : "no errors";
        if (isNotEmpty(commandValue)) {
            !isEnum(commandValue, RelationFieldsCommand)? errors.push({ field: this.options.inverseFieldName, error: 'Command Field has invalid value' }) : "no errors";
        }  
       
        var fieldValue = null
        if (commandValue === RelationFieldsCommand.clear) {
            return errors;
        } else if (linkCommands.includes(commandValue)) {
            fieldValue = dto[this.idFieldName];
        } 
        else {
            fieldValue = dto[this.valueFieldName];
        }

        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.inverseFieldName, error: `Field: ${this.options.inverseFieldName} is required` }) : "no errors";
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue, commandValue, commandFieldName));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any[], commandValue: RelationFieldsCommand, commandFieldName: string): ValidationError[] {
        const errors: ValidationError[] = [];
        if (linkCommands.includes(commandValue)) {
            for (const id of fieldValue) {
                if (!isInt(id)) {
                    errors.push({ field: this.options.inverseFieldName, error: `Invalid ids in ${commandFieldName}` });
                }
            }
        }
        return errors;
    }

    async transformForCreate(dto: any): Promise<any> {
        const currentEntityName = classify(this.options.modelSingularName);
        const currentEntityRepository = this.options.entityManager.getRepository(currentEntityName);

        const relatedEntityName = classify(this.options.relationCoModelSingularName);
        const relatedEntityRepository = this.options.entityManager.getRepository(relatedEntityName);

        const result = await this.transformByCommand(dto, relatedEntityRepository, currentEntityRepository);
        if (result !== undefined) {
            dto[this.valueFieldName] = result;
        } else {
            delete dto[this.valueFieldName];
        }
        return dto;
    }

    private async transformByCommand(dto: any, relatedEntityRepository: any, currentEntityRepository: any): Promise<any[] | undefined> {
        // TODO : Need to add support for the multiple commands
        const command = dto[this.commandFieldName];
        const values = dto[this.valueFieldName];
        const ids = dto[this.idFieldName];
        
        switch (command) {
            case RelationFieldsCommand.create:
                return await this.transformForCommandCreate(values, relatedEntityRepository);
            case RelationFieldsCommand.update:
                return await this.transformForCommandUpdate(values, relatedEntityRepository, dto, currentEntityRepository);
            case RelationFieldsCommand.delete:
                return await this.transformForCommandDelete(values, relatedEntityRepository);
            case RelationFieldsCommand.clear:
                return this.transformForCommandClear();
            case RelationFieldsCommand.set:
                return await this.transformForCommandSet(ids, relatedEntityRepository);
            case RelationFieldsCommand.link:
                return await this.tranformForCommandLink(ids, relatedEntityRepository);
            case RelationFieldsCommand.unlink:
                return await this.transformForCommandUnLink(ids);
            default:
                this.logger.log(`Invalid command ${command}`);
                return null;
        }
    }

    private transformForCommandClear() {
        return []
    }

    private async transformForCommandSet(ids: any[], relatedEntityRepository: any): Promise<any[]> {
        const loadedEntities: any[] = await relatedEntityRepository.find({
            where : {id: In(ids) }
        })
        if (loadedEntities.length !== ids.length) {
            throw new Error('Invalid entity ids provided for set');
        }

        return loadedEntities;
    }

    private async tranformForCommandLink(ids: any[], relatedEntityRepository: any): Promise<undefined> {
        if (!this.options.isUpdate) {
            throw new Error('Link command is only supported for update operations');
        }

        const count: number = await relatedEntityRepository.count({
            where: { id: In(ids) }
        });
        if (count !== ids.length) {
            throw new Error('Invalid entity ids provided for linking');
        }

        await this.options.entityManager
            .createQueryBuilder()
            .relation(classify(this.options.modelSingularName), this.valueFieldName)
            .of(this.options.entityId)
            .add(ids);

        return undefined;
    }

    private async transformForCommandUnLink(ids: any[]): Promise<undefined> {
        if (!this.options.isUpdate) {
            throw new Error('Unlink command is only supported for update operations');
        }

        await this.options.entityManager
            .createQueryBuilder()
            .relation(classify(this.options.modelSingularName), this.valueFieldName)
            .of(this.options.entityId)
            .remove(ids);

        return undefined;
    }

    private async transformForCommandCreate(values: any[], relatedEntityRepository: any): Promise<any[]> {
        const transformedRelatedFields = [];
        for (const entity of values) {
            const transformed = relatedEntityRepository.create(entity);
            transformedRelatedFields.push(transformed);
       }
        return transformedRelatedFields;
    }

    private async transformForCommandUpdate(values: any[], relatedEntityRepository: any, dto: any, currentEntityRepository: any): Promise<any[]> {
        const transformedRelatedFields = [];
        for (const entity of values) {
            if (entity.id) {
                const transformed = await relatedEntityRepository.preload(entity);
                transformedRelatedFields.push(transformed);
            }
            else {
                const transformed = relatedEntityRepository.create(entity);
                transformedRelatedFields.push(transformed);
            }
        }

        return transformedRelatedFields;
    }

    private async transformForCommandDelete(values: any[], relatedEntityRepository: any): Promise<any[]> {
        // Map and get the ids from the values
        const ids = values.map((value) => value.id);

        // Delete the ids linked to the associated entity
        await relatedEntityRepository.delete(ids);
        return null
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }

    // TODO: We have moved this to SolidRegistry service, refactor to use that service.
    // Returns the entity target class from the entity name
    // private getEntityTarget(entityName: string): any { //TODO Can be refactored to use this function from crud helper service
    //     const entityMetadatas = this.options.entityManager.connection.entityMetadatas;
    //     const entityMetadata = entityMetadatas.find(em => em.name === entityName);
    //     return entityMetadata.target;
    // }
}