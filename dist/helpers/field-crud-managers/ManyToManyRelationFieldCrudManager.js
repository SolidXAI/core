"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManyToManyRelationFieldCrudManager = void 0;
const strings_1 = require("@angular-devkit/core/src/utils/strings");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const create_field_metadata_dto_1 = require("../../dtos/create-field-metadata.dto");
const typeorm_1 = require("typeorm");
const linkCommands = [create_field_metadata_dto_1.RelationFieldsCommand.link, create_field_metadata_dto_1.RelationFieldsCommand.unlink, create_field_metadata_dto_1.RelationFieldsCommand.set];
class ManyToManyRelationFieldCrudManager {
    constructor(fieldMetadata, entityManager, isInverseSide) {
        this.fieldMetadata = fieldMetadata;
        this.entityManager = entityManager;
        this.isInverseSide = isInverseSide;
        this.logger = new common_1.Logger(ManyToManyRelationFieldCrudManager.name);
        if (!isInverseSide) {
            this.options = {
                required: fieldMetadata.required,
                relationModelSingularName: fieldMetadata.relationModelSingularName,
                modelSingularName: fieldMetadata.model.singularName,
                valueFieldName: `${this.fieldMetadata.name}`,
                idFieldName: `${this.fieldMetadata.name}Ids`,
                commandFieldName: `${this.fieldMetadata.name}Command`
            };
        }
        else {
            this.options = {
                required: false,
                relationModelSingularName: fieldMetadata.model.singularName,
                modelSingularName: fieldMetadata.relationModelSingularName,
                valueFieldName: `${this.fieldMetadata.relationModelFieldName}`,
                idFieldName: `${this.fieldMetadata.relationModelFieldName}Ids`,
                commandFieldName: `${this.fieldMetadata.relationModelFieldName}Command`
            };
        }
    }
    validate(dto) {
        return this.applyValidations(dto);
    }
    applyValidations(dto) {
        const errors = [];
        const commandFieldName = this.options.commandFieldName;
        const commandValue = dto[commandFieldName];
        this.isApplyRequiredValidation() && (0, class_validator_1.isEmpty)(commandValue) ? errors.push({ field: commandFieldName, error: 'Command field is required' }) : "no errors";
        if ((0, class_validator_1.isNotEmpty)(commandValue)) {
            !(0, class_validator_1.isEnum)(commandValue, create_field_metadata_dto_1.RelationFieldsCommand) ? errors.push({ field: this.fieldMetadata.name, error: 'Command Field has invalid value' }) : "no errors";
        }
        var fieldValue = null;
        if (commandValue === create_field_metadata_dto_1.RelationFieldsCommand.clear) {
            return errors;
        }
        else if (linkCommands.includes(commandValue)) {
            fieldValue = dto[this.options.idFieldName];
        }
        else {
            fieldValue = dto[this.options.valueFieldName];
        }
        this.isApplyRequiredValidation() && (0, class_validator_1.isEmpty)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }) : "no errors";
        if ((0, class_validator_1.isNotEmpty)(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue, commandValue, commandFieldName));
        }
        return errors;
    }
    applyFormatValidations(fieldValue, commandValue, commandFieldName) {
        const errors = [];
        if (linkCommands.includes(commandValue)) {
        }
        return errors;
    }
    async transformForCreate(dto) {
        const currentEntityTarget = this.getEntityTarget((0, strings_1.classify)(this.options.modelSingularName));
        const currentEntityRepository = this.entityManager.getRepository(currentEntityTarget);
        const relatedEntityTarget = this.getEntityTarget((0, strings_1.classify)(this.options.relationModelSingularName));
        const relatedEntityRepository = this.entityManager.getRepository(relatedEntityTarget);
        dto[this.options.valueFieldName] = await this.transformByCommand(dto, relatedEntityRepository, currentEntityRepository);
        return dto;
    }
    async transformByCommand(dto, relatedEntityRepository, currentEntityRepository) {
        const command = dto[this.options.commandFieldName];
        const values = dto[this.options.valueFieldName];
        const ids = dto[this.options.idFieldName];
        switch (command) {
            case create_field_metadata_dto_1.RelationFieldsCommand.create:
                return await this.transformForCommandCreate(values, relatedEntityRepository);
            case create_field_metadata_dto_1.RelationFieldsCommand.update:
                return await this.transformForCommandUpdate(values, relatedEntityRepository, dto, currentEntityRepository);
            case create_field_metadata_dto_1.RelationFieldsCommand.delete:
                return await this.transformForCommandDelete(values, relatedEntityRepository);
            case create_field_metadata_dto_1.RelationFieldsCommand.clear:
                return this.transformForCommandClear();
            case create_field_metadata_dto_1.RelationFieldsCommand.set:
                return await this.transformForCommandSet(ids, relatedEntityRepository, dto, currentEntityRepository);
            case create_field_metadata_dto_1.RelationFieldsCommand.link:
                return await this.tranformForCommandLink(ids, relatedEntityRepository, dto, currentEntityRepository);
            case create_field_metadata_dto_1.RelationFieldsCommand.unlink:
                return await this.transformForCommandUnLink(ids, relatedEntityRepository, dto, currentEntityRepository);
            default:
                this.logger.log(`Invalid command ${command}`);
                return null;
        }
    }
    transformForCommandClear() {
        return [];
    }
    async transformForCommandSet(ids, relatedEntityRepository, dto, currentEntityRepository) {
        const loadedEntities = await relatedEntityRepository.find({
            where: { id: (0, typeorm_1.In)(ids) }
        });
        if (loadedEntities.length !== ids.length) {
            throw new Error('Invalid entity ids provided for linking');
        }
        return loadedEntities;
    }
    async tranformForCommandLink(ids, relatedEntityRepository, dto, currentEntityRepository) {
        const tranformedRelatedFields = [];
        const loadedEntities = await relatedEntityRepository.find({
            where: { id: (0, typeorm_1.In)(ids) }
        });
        if (loadedEntities.length !== ids.length) {
            throw new Error('Invalid entity ids provided for linking');
        }
        tranformedRelatedFields.push(...loadedEntities);
        return tranformedRelatedFields;
    }
    async transformForCommandUnLink(ids, relatedEntityRepository, dto, currentEntityRepository) {
        if (dto.id == null) {
            throw new Error('Entity id is required for unlinking');
        }
        const tranformedRelatedFields = [];
        const entityInstance = await currentEntityRepository.findOne({
            where: { id: dto.id },
            relations: [this.options.valueFieldName]
        });
        const filteredEntities = entityInstance[this.options.valueFieldName].filter((entity) => !ids.includes(entity.id));
        tranformedRelatedFields.push(...filteredEntities);
        return tranformedRelatedFields;
    }
    async transformForCommandCreate(values, relatedEntityRepository) {
        const transformedRelatedFields = [];
        for (const entity of values) {
            const transformed = relatedEntityRepository.create(entity);
            transformedRelatedFields.push(transformed);
        }
        return transformedRelatedFields;
    }
    async transformForCommandUpdate(values, relatedEntityRepository, dto, currentEntityRepository) {
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
    async transformForCommandDelete(values, relatedEntityRepository) {
        const ids = values.map((value) => value.id);
        await relatedEntityRepository.delete(ids);
        return null;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
    getEntityTarget(entityName) {
        const entityMetadatas = this.entityManager.connection.entityMetadatas;
        const entityMetadata = entityMetadatas.find(em => em.name === entityName);
        return entityMetadata.target;
    }
}
exports.ManyToManyRelationFieldCrudManager = ManyToManyRelationFieldCrudManager;
//# sourceMappingURL=ManyToManyRelationFieldCrudManager.js.map