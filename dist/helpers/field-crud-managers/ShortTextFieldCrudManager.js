"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortTextFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
class ShortTextFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.options = { length: fieldMetadata.max, regexPattern: fieldMetadata.regexPattern, required: fieldMetadata.required };
    }
    validate(dto, _files) {
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
        this.isApplyStringValidation() && !(0, class_validator_1.isString)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a string' }) : "no errors";
        this.isApplyLengthValidation() && !(0, class_validator_1.length)(fieldValue, 1, this.options.length) ? errors.push({ field: this.fieldMetadata.name, error: 'Field length is invalid' }) : "no errors";
        this.isApplyRegexValidation() && !(0, class_validator_1.matches)(fieldValue, new RegExp(this.options.regexPattern)) ? errors.push({ field: this.fieldMetadata.name, error: 'Field regex pattern is invalid' }) : "no errors";
        return errors;
    }
    transformForCreate(dto) {
        return dto;
    }
    isApplyStringValidation() {
        return true;
    }
    isApplyLengthValidation() {
        return (this.options.length > 0);
    }
    isApplyRegexValidation() {
        return this.options.regexPattern !== null && this.options.regexPattern !== undefined && this.options.regexPattern.trim().length > 0;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
}
exports.ShortTextFieldCrudManager = ShortTextFieldCrudManager;
//# sourceMappingURL=ShortTextFieldCrudManager.js.map