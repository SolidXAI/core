"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaFieldCrudManager = exports.MediaType = void 0;
var MediaType;
(function (MediaType) {
    MediaType["mediaSingle"] = "mediaSingle";
    MediaType["mediaMultiple"] = "mediaMultiple";
})(MediaType || (exports.MediaType = MediaType = {}));
class MediaFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
        this.options = { required: fieldMetadata.required, type: fieldMetadata.type };
    }
    validate(dto, files) {
        const isValidateForUpdate = dto.id !== undefined;
        const fieldFiles = files.filter(file => file.fieldname === this.fieldMetadata.name);
        return this.applyValidations(fieldFiles, isValidateForUpdate);
    }
    applyValidations(fieldFiles, isValidateForUpdate) {
        switch (this.options.type) {
            case MediaType.mediaSingle:
                return this.validateMediaSingle(fieldFiles, isValidateForUpdate);
            case MediaType.mediaMultiple:
                return this.validateMediaMultiple(fieldFiles, isValidateForUpdate);
            default:
                return [];
        }
    }
    validateMediaSingle(fieldFiles, isValidateForUpdate) {
        const errors = [];
        if (!isValidateForUpdate && this.options.required && fieldFiles.length === 0) {
            errors.push({
                field: this.fieldMetadata.name,
                error: `${this.fieldMetadata.name} is required`
            });
        }
        if (fieldFiles.length > 1) {
            errors.push({
                field: this.fieldMetadata.name,
                error: `${this.fieldMetadata.name} must be a single file`
            });
        }
        return errors;
    }
    validateMediaMultiple(fieldFiles, isValidateForUpdate) {
        const errors = [];
        if (!isValidateForUpdate && this.options.required && fieldFiles.length === 0) {
            errors.push({
                field: this.fieldMetadata.name,
                error: `${this.fieldMetadata.name} is required`
            });
        }
        return errors;
    }
    transformForCreate(dto) {
        return dto;
    }
}
exports.MediaFieldCrudManager = MediaFieldCrudManager;
//# sourceMappingURL=MediaFieldCrudManager.js.map