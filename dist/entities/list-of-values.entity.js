"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListOfValues = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
let ListOfValues = class ListOfValues extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { type: { required: true, type: () => String }, value: { required: true, type: () => String }, display: { required: true, type: () => String }, description: { required: true, type: () => String }, default: { required: true, type: () => Boolean }, sequence: { required: true, type: () => Number } };
    }
};
exports.ListOfValues = ListOfValues;
__decorate([
    (0, typeorm_1.Column)({ name: "type" }),
    __metadata("design:type", String)
], ListOfValues.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "value" }),
    __metadata("design:type", String)
], ListOfValues.prototype, "value", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "display" }),
    __metadata("design:type", String)
], ListOfValues.prototype, "display", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "description" }),
    __metadata("design:type", String)
], ListOfValues.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "default" }),
    __metadata("design:type", Boolean)
], ListOfValues.prototype, "default", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "sequence" }),
    __metadata("design:type", Number)
], ListOfValues.prototype, "sequence", void 0);
exports.ListOfValues = ListOfValues = __decorate([
    (0, typeorm_1.Entity)("ss_list_of_values")
], ListOfValues);
//# sourceMappingURL=list-of-values.entity.js.map