"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UuidExternalIdComputedFieldProvider = void 0;
const uuid_1 = require("uuid");
const common_1 = require("@nestjs/common");
const computed_field_provider_decorator_1 = require("../../decorators/computed-field-provider.decorator");
let UuidExternalIdComputedFieldProvider = class UuidExternalIdComputedFieldProvider {
    name() {
        return "UuidExternalIdComputedFieldProvider";
    }
    help() {
        return "Computed field provider used to compute the external id field as a UUID.";
    }
    valueType() {
        return "string";
    }
    async computeValue(dto, ctxt) {
        const prefix = ctxt.prefix;
        return `${prefix}-${(0, uuid_1.v4)()}`;
    }
};
exports.UuidExternalIdComputedFieldProvider = UuidExternalIdComputedFieldProvider;
exports.UuidExternalIdComputedFieldProvider = UuidExternalIdComputedFieldProvider = __decorate([
    (0, computed_field_provider_decorator_1.ComputedFieldProvider)(),
    (0, common_1.Injectable)()
], UuidExternalIdComputedFieldProvider);
//# sourceMappingURL=uuid-external-id-computed-field-provider.service.js.map