"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailFieldCrudManager = exports.MAX_EMAIL_LENGTH = void 0;
const class_validator_1 = require("class-validator");
exports.MAX_EMAIL_LENGTH = 254;
class EmailFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.options = { required: fieldMetadata.required, max: fieldMetadata.max ?? exports.MAX_EMAIL_LENGTH, regexPattern: fieldMetadata.regexPattern };
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
        !(0, class_validator_1.isEmail)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not an email' }) : "no errors";
        this.isApplyMaxValidation() && fieldValue.length > this.options.max ? errors.push({ field: this.fieldMetadata.name, error: 'Field is greater than max length' }) : "no errors";
        this.isApplyRegexValidation() && !(0, class_validator_1.matches)(fieldValue, new RegExp(this.options.regexPattern)) ? errors.push({ field: this.fieldMetadata.name, error: 'Field does not match regex pattern' }) : "no errors";
        return errors;
    }
    transformForCreate(dto) {
        return dto;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
    isApplyMaxValidation() {
        return (this.options.max > 0);
    }
    isApplyRegexValidation() {
        return (0, class_validator_1.isNotEmpty)(this.options.regexPattern);
    }
}
exports.EmailFieldCrudManager = EmailFieldCrudManager;
//# sourceMappingURL=EmailFieldCrudManager.js.map