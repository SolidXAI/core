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
exports.CreateListOfValuesDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
class CreateListOfValuesDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { type: { required: true, type: () => String }, value: { required: true, type: () => String }, display: { required: true, type: () => String }, description: { required: true, type: () => String }, default: { required: true, type: () => Boolean }, sequence: { required: true, type: () => Number } };
    }
}
exports.CreateListOfValuesDto = CreateListOfValuesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Type of the LOV" }),
    __metadata("design:type", String)
], CreateListOfValuesDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Value of the LOV" }),
    __metadata("design:type", String)
], CreateListOfValuesDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Display of the LOV" }),
    __metadata("design:type", String)
], CreateListOfValuesDto.prototype, "display", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Description of the LOV" }),
    __metadata("design:type", String)
], CreateListOfValuesDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Default value of the LOV type" }),
    __metadata("design:type", Boolean)
], CreateListOfValuesDto.prototype, "default", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Sequence of the LOV" }),
    __metadata("design:type", Number)
], CreateListOfValuesDto.prototype, "sequence", void 0);
//# sourceMappingURL=create-list-of-values.dto.js.map