import { classify } from "@angular-devkit/core/src/utils/strings";
import { Logger } from "@nestjs/common";
import { isEmpty, isEnum, isNotEmpty } from "class-validator";
import { RelationFieldsCommand } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EntityManager, In } from "typeorm";

export interface ManyToManyRelationFieldOptions {
    // Add options for relation field
    required: boolean | undefined | null;
    relationCoModelSingularName: string | undefined | null;
    modelSingularName: string | undefined | null;
    isInverseSide: boolean;
    entityManager: EntityManager;
    fieldName: string;
    relationCoModelFieldName?: string;
}

const linkCommands = [RelationFieldsCommand.link, RelationFieldsCommand.unlink, RelationFieldsCommand.set];

// This implementation is meant to be used for many-to-one relation field
export class ManyToManyRelationFieldCrudManager implements FieldCrudManager {
    private readonly logger = new Logger(ManyToManyRelationFieldCrudManager.name);

    private valueFieldName: string;
    private idFieldName: string;
    private commandFieldName: string;

    constructor(private readonly options: ManyToManyRelationFieldOptions) {
        if (!this.options.isInverseSide) {
            this.valueFieldName = `${this.options.fieldName}`;
            this.idFieldName = `${this.options.fieldName}Ids`;
            this.commandFieldName = `${this.options.fieldName}Command`;
        }
        else {
            this.valueFieldName = `${this.options.relationCoModelFieldName}`;
            this.idFieldName = `${this.options.relationCoModelFieldName}Ids`;
            this.commandFieldName = `${this.options.relationCoModelFieldName}Command`;
        }
    }

    validate(dto: any) {
        return this.applyValidations(dto);
    }

    private applyValidations(dto: any): ValidationError[] { 
        const errors: ValidationError[] = [];

        const commandFieldName = this.commandFieldName;
        const commandValue = dto[commandFieldName];
        this.isApplyRequiredValidation() && isEmpty(commandValue) ? errors.push({ field: commandFieldName, error: 'Command field is required' }) : "no errors";
        if (isNotEmpty(commandValue)) {
            !isEnum(commandValue, RelationFieldsCommand)? errors.push({ field: this.options.fieldName, error: 'Command Field has invalid value' }) : "no errors";
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

        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required` }) : "no errors";
        return errors;
    }

    async transformForCreate(dto: any): Promise<any> {
        const currentEntityName = classify(this.options.modelSingularName);
        const currentEntityRepository = this.options.entityManager.getRepository(currentEntityName);

        const relatedEntityName = classify(this.options.relationCoModelSingularName);
        const relatedEntityRepository = this.options.entityManager.getRepository(relatedEntityName)

        dto[this.valueFieldName] = await this.transformByCommand(dto, relatedEntityRepository, currentEntityRepository);
        return dto;
    }

    private async transformByCommand(dto: any, relatedEntityRepository: any, currentEntityRepository: any): Promise<any[]> {
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
                return await this.transformForCommandSet(ids, relatedEntityRepository, dto, currentEntityRepository);    
            case RelationFieldsCommand.link:
                return await this.tranformForCommandLink(ids, relatedEntityRepository, dto, currentEntityRepository);
            case RelationFieldsCommand.unlink:
                return await this.transformForCommandUnLink(ids, relatedEntityRepository, dto, currentEntityRepository);
            default:
                this.logger.log(`Invalid command ${command}`);
                return null;
                
        }
    }

    private transformForCommandClear() {
        return []
    }

    private async transformForCommandSet(ids: any[], relatedEntityRepository: any,  dto: any, currentEntityRepository: any): Promise<any[]> {
        // Load the entities with the ids passed
        const loadedEntities: any[] = await relatedEntityRepository.find({
            where : {id: In(ids) } 
        })
        if (loadedEntities.length !== ids.length) {
            throw new Error('Invalid entity ids provided for linking');
        }

        return loadedEntities;
    }

    private async tranformForCommandLink(ids: any, relatedEntityRepository: any, dto: any, currentEntityRepository: any) {
        const tranformedRelatedFields = [];
        // Load the entities with the ids passed
        const loadedEntities: any[] = await relatedEntityRepository.find({
            where : {id: In(ids) } 
        })
        if (loadedEntities.length !== ids.length) {
            throw new Error('Invalid entity ids provided for linking');
        }
        tranformedRelatedFields.push(...loadedEntities);

        return tranformedRelatedFields;
    }

    private async transformForCommandUnLink(ids: any, relatedEntityRepository: any, dto: any, currentEntityRepository: any) {
        if (dto.id == null) {
            throw new Error('Entity id is required for unlinking');
        } 

        const tranformedRelatedFields = [];
        const entityInstance = await currentEntityRepository.findOne({
            where: {id: dto.id},
            relations: [this.valueFieldName]
        });
        const filteredEntities = entityInstance[this.valueFieldName].filter((entity) => !ids.includes(entity.id));
        tranformedRelatedFields.push(...filteredEntities);

        return tranformedRelatedFields;
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
