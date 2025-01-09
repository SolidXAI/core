"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUIDFieldCrudManager = void 0;
const class_validator_1 = require("class-validator");
const uuid_1 = require("uuid");
const UUID_REGEX = `^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`;
class UUIDFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
    }
    validate(dto) {
        const fieldValue = dto[this.fieldMetadata.name];
        return this.applyValidations(fieldValue);
    }
    applyValidations(fieldValue) {
        const errors = [];
        if ((0, class_validator_1.isNotEmpty)(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue));
        }
        return errors;
    }
    applyFormatValidations(fieldValue) {
        const errors = [];
        !this.isUUID(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `${this.fieldMetadata.name} is not a valid UUID` }) : "no errors";
        return errors;
    }
    transformForCreate(dto) {
        const fieldValue = dto[this.fieldMetadata.name];
        if ((0, class_validator_1.isEmpty)(fieldValue))
            dto[this.fieldMetadata.name] = this.generateUUID();
        return dto;
    }
    isUUID(fieldValue) {
        return (0, class_validator_1.matches)(fieldValue, new RegExp(UUID_REGEX));
    }
    generateUUID() {
        return (0, uuid_1.v4)();
    }
}
exports.UUIDFieldCrudManager = UUIDFieldCrudManager;
//# sourceMappingURL=UUIDFieldCrudManager.js.map