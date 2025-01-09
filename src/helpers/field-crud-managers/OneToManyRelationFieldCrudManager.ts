import { classify } from "@angular-devkit/core/src/utils/strings";
import { isEmpty, isEnum, isInt, isNotEmpty } from "class-validator";
import { RelationFieldsCommand } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EntityManager, In } from "typeorm";

interface OneToManyRelationFieldOptions {
    // Add options for relation field
    // type: string | undefined | null;
    required: boolean | undefined | null;
    relationModelSingularName: string | undefined | null;
    modelSingularName: string | undefined | null;
    valueFieldName: string | undefined | null;
    idFieldName: string | undefined | null;
    commandFieldName: string | undefined | null;
}

const linkCommands = [RelationFieldsCommand.link, RelationFieldsCommand.unlink, RelationFieldsCommand.set];

// This implementation is meant to be used for many-to-one relation field
export class OneToManyRelationFieldCrudManager implements FieldCrudManager {
    private options: OneToManyRelationFieldOptions;

    constructor(readonly fieldMetadata: FieldMetadata, readonly entityManager: EntityManager, readonly isInverseSide: boolean) {
        if (isInverseSide == false) throw new Error('OneToManyRelationFieldCrudManager can only be used for inverse side of the entity');
        const relationModelFieldNamePrefix = this.fieldMetadata.relationModelFieldName ?? this.fieldMetadata.model.singularName;
        const valueFieldName = this.fieldMetadata.relationModelFieldName ?? `${relationModelFieldNamePrefix}s`;
        this.options = { 
            required: false,
            relationModelSingularName: fieldMetadata.model.singularName, // Since this field metadata is of the inverse side
            modelSingularName: fieldMetadata.relationModelSingularName, // Since this field metadata is of the inverse side
            valueFieldName: valueFieldName,
            idFieldName: `${relationModelFieldNamePrefix}Ids`,
            commandFieldName: `${relationModelFieldNamePrefix}Command`
        };
    }

    validate(dto: any) {
        return this.applyValidations(dto);
    }

    private applyValidations(dto: any): ValidationError[] { 
        const errors: ValidationError[] = [];

        const commandFieldName = this.options.commandFieldName;
        const commandValue = dto[commandFieldName];
        this.isApplyRequiredValidation() && isEmpty(commandValue) ? errors.push({ field: commandFieldName, error: 'Command field is  required' }) : "no errors";
        if (isNotEmpty(commandValue)) {
            !isEnum(commandValue, RelationFieldsCommand)? errors.push({ field: this.fieldMetadata.name, error: 'Command Field has invalid value' }) : "no errors";
        }  
       
        var fieldValue = null
        if (commandValue === RelationFieldsCommand.clear) {
            return errors;
        } else if (linkCommands.includes(commandValue)) {
            fieldValue = dto[this.options.idFieldName];
        } 
        else {
            fieldValue = dto[this.options.valueFieldName];
        }

        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }) : "no errors";
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
                    errors.push({ field: this.fieldMetadata.name, error: `Invalid ids in ${commandFieldName}` });
                }
            }
        }
        return errors;
    }

    // private fieldName(): string {
    //     //FIXME: Need to finalize the approach for many-to-many multiple fields
    //     return `${this.fieldMetadata.name}s`;
    // }

    async transformForCreate(dto: any): Promise<any> {
        // const relatedFieldData: any[] = dto[this.fieldName()];
        const currentEntityTarget = this.getEntityTarget(classify(this.options.modelSingularName));
        const currentEntityRepository = this.entityManager.getRepository(currentEntityTarget);

        const relatedEntityTarget = this.getEntityTarget(classify(this.options.relationModelSingularName));
        const relatedEntityRepository = this.entityManager.getRepository(relatedEntityTarget)

        dto[this.options.valueFieldName] = await this.transformByCommand(dto, relatedEntityRepository, currentEntityRepository);
        return dto;
    }

    private async transformByCommand(dto: any, relatedEntityRepository: any, currentEntityRepository: any): Promise<any[]> {
        // TODO : Need to add support for the multiple commands
        const command = dto[this.options.commandFieldName];
        const values = dto[this.options.valueFieldName];
        const ids = dto[this.options.idFieldName];
        
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
                return null; // This is equivalent to no transformation
        }
    }

    private transformForCommandClear() {
        return []
    }

    private async transformForCommandSet(ids: any[], relatedEntityRepository: any, dto: any, currentEntityRepository: any): Promise<any[]> {
        // Load the entities with the ids passed
        const loadedEntities: any[] = await relatedEntityRepository.find({
            where : {id: In(ids) } 
        })
        if (loadedEntities.length !== ids.length) {
            throw new Error('Invalid entity ids provided for linking');
        }

        /*if (dto.id != null) { //clear the existing associations from the join table
            const entityInstance = await currentEntityRepository.findOne({
                where: {id: dto.id},
                relations: [this.options.valueFieldName]
            });

            // Now clear all the association in the join table after we have managed the transformation
            await currentEntityRepository.
            createQueryBuilder()
            .relation(this.getEntityTarget(classify(this.options.modelSingularName)), this.options.valueFieldName)
            .of(dto.id)
            .remove(entityInstance[this.options.valueFieldName]);
        }*///TODO: Need to test this code. This probably will work as commented out after changing id from bigint to integer

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

        // If dto has an id, then it is an update operation, load existing related entities
        /*if (dto.id != null) {
            const entityInstance = await currentEntityRepository.findOne({
                where: {id: dto.id},
                relations: [this.options.valueFieldName]
            });
            tranformedRelatedFields.push(...entityInstance[this.options.valueFieldName]);

            // Now clear all the association in the join table after we have managed the transformation
            await currentEntityRepository.
            createQueryBuilder()
            .relation(this.getEntityTarget(classify(this.options.modelSingularName)), this.options.valueFieldName)
            .of(dto.id)
            .remove(entityInstance[this.options.valueFieldName]);
        }*///TODO: Need to test this code. This probably will work as commented out after changing id from bigint to integer
        return tranformedRelatedFields;
    }

    private async transformForCommandUnLink(ids: any, relatedEntityRepository: any, dto: any, currentEntityRepository: any) {
        if (dto.id == null) {
            throw new Error('Entity id is required for unlinking');
        } 

        const tranformedRelatedFields = [];
        const entityInstance = await currentEntityRepository.findOne({
            where: {id: dto.id},
            relations: [this.options.valueFieldName]
        });
        const filteredEntities = entityInstance[this.options.valueFieldName].filter((entity) => !ids.includes(entity.id));
        tranformedRelatedFields.push(...filteredEntities);

        // Now clear all the association in the join table after we have managed the transformation
        /*await currentEntityRepository.
        createQueryBuilder()
        .relation(this.getEntityTarget(classify(this.options.modelSingularName)), this.options.valueFieldName)
        .of(dto.id)
        .remove(entityInstance[this.options.valueFieldName]);*///TODO: Need to test this code. This probably will work as commented out after changing id from bigint to integer
        
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

        /*if (dto.id != null) { //clear the existing associations from the join table
            const entityInstance = await currentEntityRepository.findOne({
                where: {id: dto.id},
                relations: [this.options.valueFieldName]
            });

            // Now clear all the association in the join table after we have managed the transformation
            await currentEntityRepository.
            createQueryBuilder()
            .relation(this.getEntityTarget(classify(this.options.modelSingularName)), this.options.valueFieldName)
            .of(dto.id)
            .remove(entityInstance[this.options.valueFieldName]);
        }*///TODO: Need to test this code. This probably will work as commented out after changing id from bigint to integer

        
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

    // Returns the entity target class from the entity name
    private getEntityTarget(entityName: string): any { //TODO Can be refactored to use this function from crud helper service
        const entityMetadatas = this.entityManager.connection.entityMetadatas;
        const entityMetadata = entityMetadatas.find(em => em.name === entityName);
        return entityMetadata.target;
    }
}