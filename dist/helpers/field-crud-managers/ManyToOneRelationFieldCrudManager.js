"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManyToOneRelationFieldCrudManager = void 0;
const strings_1 = require("@angular-devkit/core/src/utils/strings");
const class_validator_1 = require("class-validator");
const is_parsable_int_1 = require("../../validators/is-parsable-int");
class ManyToOneRelationFieldCrudManager {
    constructor(fieldMetadata, entityManager) {
        this.fieldMetadata = fieldMetadata;
        this.entityManager = entityManager;
        this.options = {
            required: fieldMetadata.required,
            relationModelSingularName: fieldMetadata.relationModelSingularName,
            userKeyName: fieldMetadata.model?.userKeyField?.name,
            idFieldName: `${fieldMetadata.name}Id`,
            userKeyFieldName: `${fieldMetadata.name}UserKey`
        };
    }
    validate(dto) {
        const fieldId = dto[this.options.idFieldName];
        const fieldUserKey = dto[this.options.userKeyFieldName];
        return this.applyValidations(fieldId, fieldUserKey);
    }
    applyValidations(fieldId, fieldUserKey) {
        const errors = [];
        this.isApplyRequiredValidation() && (0, class_validator_1.isEmpty)(fieldId) && (0, class_validator_1.isEmpty)(fieldUserKey) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required. Either pass ${this.options.idFieldName} or ${this.options.userKeyFieldName}.` }) : "no errors";
        if ((0, class_validator_1.isNotEmpty)(fieldId)) {
            errors.push(...this.applyIdFormatValidations(fieldId));
        }
        if ((0, class_validator_1.isNotEmpty)(fieldUserKey)) {
            errors.push(...this.applyUserKeyFormatValidations(fieldUserKey));
        }
        return errors;
    }
    applyIdFormatValidations(fieldId) {
        const errors = [];
        !(0, is_parsable_int_1.IsParsableInt)(fieldId) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a integer' }) : "no errors";
        return errors;
    }
    applyUserKeyFormatValidations(fieldUserKey) {
        const errors = [];
        !(0, class_validator_1.isString)(fieldUserKey) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a string' }) : "no errors";
        if ((0, class_validator_1.isEmpty)(this.options.userKeyName)) {
            errors.push({ field: this.fieldMetadata.name, error: `UserKey field name is not defined in the model ${this.fieldMetadata.model.singularName}` });
        }
        return errors;
    }
    async transformForCreate(dto) {
        const fieldId = dto[this.options.idFieldName];
        const fieldUserKey = dto[this.options.userKeyFieldName];
        if (((0, class_validator_1.isEmpty)(fieldId)) && (0, class_validator_1.isEmpty)(fieldUserKey))
            return dto;
        const entityTarget = this.getRelatedEntityTarget((0, strings_1.classify)(this.options.relationModelSingularName));
        if ((0, class_validator_1.isNotEmpty)(fieldId)) {
            dto[this.fieldMetadata.name] = await this.entityManager.getRepository(entityTarget).findOneBy({ id: fieldId });
        }
        else {
            dto[this.fieldMetadata.name] = await this.entityManager.getRepository(entityTarget).findOneBy({ [this.options.userKeyName]: fieldUserKey });
        }
        return dto;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
    getRelatedEntityTarget(relatedEntityName) {
        const entityMetadatas = this.entityManager.connection.entityMetadatas;
        const relatedEntityMetadata = entityMetadatas.find(em => em.name === relatedEntityName);
        return relatedEntityMetadata.target;
    }
}
exports.ManyToOneRelationFieldCrudManager = ManyToOneRelationFieldCrudManager;
//# sourceMappingURL=ManyToOneRelationFieldCrudManager.js.map