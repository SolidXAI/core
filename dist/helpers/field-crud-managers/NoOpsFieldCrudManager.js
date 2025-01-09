"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoOpsFieldCrudManager = void 0;
class NoOpsFieldCrudManager {
    constructor(fieldMetadata) {
        this.fieldMetadata = fieldMetadata;
    }
    validate(dto) {
        return [];
    }
    transformForCreate(dto) {
        return dto;
    }
}
exports.NoOpsFieldCrudManager = NoOpsFieldCrudManager;
//# sourceMappingURL=NoOpsFieldCrudManager.js.map