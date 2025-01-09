"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
class IntFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.options = { min: fieldMetadata.min, max: fieldMetadata.max, required: fieldMetadata.required };
    }
    validate(createDto) {
        const fieldValue = createDto[this.fieldMetadata.name];
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
        !(0, class_validator_1.isInt)(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: 'Field is not an int' }) : "no errors";
        (this.isApplyMinValidation() && !(0, class_validator_1.min)(fieldValue, this.options.min)) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is lesser than minimum required' }) : "no errors";
        (this.isApplyMaxValidation() && !(0, class_validator_1.max)(fieldValue, this.options.max)) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is greater than maximum required' }) : "no errors";
        return errors;
    }
    transformForCreate(createDto) {
        return createDto;
    }
    isApplyMinValidation() {
        return this.options.min > 0;
    }
    isApplyMaxValidation() {
        return this.options.max > 0;
    }
    isApplyRequiredValidation() {
        return this.options.required;
    }
}
exports.IntFieldCrudManager = IntFieldCrudManager;
//# sourceMappingURL=IntFieldCrudManager.js.map