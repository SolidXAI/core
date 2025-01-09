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
exports.BasicFilterDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const pagination_query_dto_1 = require("./pagination-query.dto");
class BasicFilterDto extends pagination_query_dto_1.PaginationQueryDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { fields: { required: false, type: () => [String] }, sort: { required: false, type: () => [String] }, groupBy: { required: false, type: () => [String] }, populate: { required: false, type: () => [String] }, populateMedia: { required: false, type: () => [String] }, showSoftDeleted: { required: false, type: () => Boolean }, showOnlySoftDeleted: { required: false, type: () => Boolean }, populateGroup: { required: false, type: () => Boolean } };
    }
}
exports.BasicFilterDto = BasicFilterDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "Fields" }),
    __metadata("design:type", Array)
], BasicFilterDto.prototype, "fields", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "sort" }),
    __metadata("design:type", Array)
], BasicFilterDto.prototype, "sort", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "groupBy" }),
    __metadata("design:type", Array)
], BasicFilterDto.prototype, "groupBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "populate" }),
    __metadata("design:type", Array)
], BasicFilterDto.prototype, "populate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "populateMedia" }),
    __metadata("design:type", Array)
], BasicFilterDto.prototype, "populateMedia", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "showSoftDeleted" }),
    __metadata("design:type", Boolean)
], BasicFilterDto.prototype, "showSoftDeleted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "showOnlySoftDeleted" }),
    __metadata("design:type", Boolean)
], BasicFilterDto.prototype, "showOnlySoftDeleted", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: "populateGroup" }),
    __metadata("design:type", Boolean)
], BasicFilterDto.prototype, "populateGroup", void 0);
//# sourceMappingURL=basic-filters.dto.js.map