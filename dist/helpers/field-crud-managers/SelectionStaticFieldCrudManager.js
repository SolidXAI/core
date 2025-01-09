"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionStaticFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
const create_field_metadata_dto_1 = require("../../dtos/create-field-metadata.dto");
class SelectionStaticFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.options = { selectionStaticValues: fieldMetadata.selectionStaticValues, selectionValueType: fieldMetadata.selectionValueType, required: fieldMetadata.required };
    }
    validate(dto) {
        const fieldValue = dto[this.fieldMetadata.name];
        return this.applyValidations(fieldValue);
    }
    applyValidations(fieldValue) {
        const errors = [];
        this.isApplyRequiredValidation() && (0, class_validator_1.isEmpty)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }) : "no errors";
        if ((0, class_validator_1.isNotEmpty)(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue));
        }
        return errors;
    }
    applyFormatValidations(fieldValue) {
        const errors = [];
        !this.isValidSelectionValueType(fieldValue, this.options.selectionValueType) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is invalid' }) : "no errors";
        !this.isValidSelectionStaticValue(fieldValue, this.options.selectionValueType, this.options.selectionStaticValues) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is invalid' }) : "no errors";
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
    isValidSelectionStaticValue(fieldValue, selectionValueType, selectionStaticValues) {
        switch (selectionValueType) {
            case create_field_metadata_dto_1.SelectionValueType.string:
                return selectionStaticValues.map(v => v.split(":")[0]).includes(fieldValue);
            case create_field_metadata_dto_1.SelectionValueType.int:
                return selectionStaticValues.map(v => Number(v.split(":")[0])).includes(fieldValue);
            default:
                throw new Error(`Validation for selection value type ${selectionValueType} is not implemented`);
        }
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
}
exports.SelectionStaticFieldCrudManager = SelectionStaticFieldCrudManager;
//# sourceMappingURL=SelectionStaticFieldCrudManager.js.map