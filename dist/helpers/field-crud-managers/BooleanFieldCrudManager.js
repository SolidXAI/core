"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BooleanFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
class BooleanFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.options = { required: fieldMetadata.required };
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
        !(0, class_validator_1.isBoolean)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is not a boolean value` }) : "no errors";
        return errors;
    }
    transformForCreate(dto) {
        return dto;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
}
exports.BooleanFieldCrudManager = BooleanFieldCrudManager;
//# sourceMappingURL=BooleanFieldCrudManager.js.map