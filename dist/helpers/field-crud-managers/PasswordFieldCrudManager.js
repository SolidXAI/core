"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
const bcrypt_service_1 = require("../../services/bcrypt.service");
class PasswordFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.hashingService = new bcrypt_service_1.BcryptService();
        this.options = { required: fieldMetadata.required, min: fieldMetadata.min, max: fieldMetadata.max, regexPattern: fieldMetadata.regexPattern };
    }
    validate(dto) {
        const fieldValue = dto[this.fieldMetadata.name];
        return this.applyValidations(fieldValue, dto);
    }
    applyValidations(fieldValue, dto) {
        const errors = [];
        this.isApplyRequiredValidation() && (0, class_validator_1.isEmpty)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }) : "no errors";
        if ((0, class_validator_1.isNotEmpty)(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue, dto));
        }
        return errors;
    }
    applyFormatValidations(fieldValue, dto) {
        const errors = [];
        !(0, class_validator_1.isString)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not a string' }) : "no errors";
        !this.isPasswordValid(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Password regex pattern is invalid' }) : "no errors";
        this.isApplyMinValidation() && !(0, class_validator_1.min)(fieldValue, this.options.min) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is lesser than minimum required' }) : "no errors";
        this.isApplyMaxValidation() && !(0, class_validator_1.max)(fieldValue, this.options.max) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is greater than maximum required' }) : "no errors";
        !this.isConfirmPasswordValid(dto) ? errors.push({ field: this.fieldMetadata.name, error: 'Password and confirm password do not match' }) : "no errors";
        return errors;
    }
    async transformForCreate(dto) {
        dto[this.fieldMetadata.name] = await this.hashingService.hash(dto[this.fieldMetadata.name]);
        return dto;
    }
    isApplyMinValidation() {
        return this.options.min > 0;
    }
    isApplyMaxValidation() {
        return this.options.max > 0;
    }
    isPasswordValid(password) {
        return (0, class_validator_1.matches)(password, new RegExp(this.options.regexPattern ?? String.raw `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$`));
    }
    isConfirmPasswordValid(dto) {
        const passwordFieldName = this.fieldMetadata.name;
        const confirmPasswordFieldName = `${passwordFieldName}Confirm`;
        return dto[passwordFieldName] === dto[confirmPasswordFieldName];
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
}
exports.PasswordFieldCrudManager = PasswordFieldCrudManager;
//# sourceMappingURL=PasswordFieldCrudManager.js.map