"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionDynamicFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
const create_field_metadata_dto_1 = require("../../dtos/create-field-metadata.dto");
class SelectionDynamicFieldCrudManager {
    constructor(fieldMetadata, discoveryService) {
        this.fieldMetadata = fieldMetadata;
        this.discoveryService = discoveryService;
        this.options = { selectionDynamicProvider: fieldMetadata.selectionDynamicProvider, selectionDynamicProviderCtxt: fieldMetadata.selectionDynamicProviderCtxt, selectionValueType: fieldMetadata.selectionValueType, required: fieldMetadata.required };
    }
    async validate(dto) {
        const fieldValue = dto[this.fieldMetadata.name];
        return this.applyValidations(fieldValue);
    }
    async applyValidations(fieldValue) {
        const errors = [];
        this.isApplyRequiredValidation() && (0, class_validator_1.isEmpty)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }) : "no errors";
        if ((0, class_validator_1.isNotEmpty)(fieldValue)) {
            const formatErrors = await this.applyFormatValidations(fieldValue);
            errors.push(...formatErrors);
        }
        return errors;
    }
    async applyFormatValidations(fieldValue) {
        const errors = [];
        !this.isValidSelectionValueType(fieldValue, this.options.selectionValueType) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value type is invalid' }) : "no errors";
        const _isValidSelectionValue = await this.isValidSelectionValue(fieldValue, this.options.selectionDynamicProvider);
        !_isValidSelectionValue ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is invalid' }) : "no errors";
        return errors;
    }
    transformForCreate(dto) {
        return dto;
    }
    isValidSelectionValueType(fieldValue, selectionValueType) {
        switch (selectionValueType) {
            case create_field_metadata_dto_1.SelectionValueType.string:
                return (0, class_validator_1.isString)(fieldValue);
            case create_field_metadata_dto_1.SelectionValueType.int:
                return (0, class_validator_1.isInt)(fieldValue);
            default:
                throw new Error(`Validation for selection value type ${selectionValueType} is not implemented`);
        }
    }
    async isValidSelectionValue(fieldValue, selectionDynamicProvider) {
        const providerInstance = this.providerInstance(selectionDynamicProvider);
        const values = await providerInstance.values('', this.options.selectionDynamicProviderCtxt);
        return values.map(v => v.value).includes(fieldValue);
    }
    providerInstance(selectionDynamicProvider) {
        const provider = this.discoveryService
            .getProviders()
            .filter((provider) => provider.name === selectionDynamicProvider)
            .pop();
        if (!provider) {
            throw new Error(`Provider for ${selectionDynamicProvider} not found`);
        }
        return provider.instance;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
}
exports.SelectionDynamicFieldCrudManager = SelectionDynamicFieldCrudManager;
//# sourceMappingURL=SelectionDynamicFieldCrudManager.js.map