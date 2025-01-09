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
exports.SelectionDynamicQueryDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_query_dto_1 = require("./pagination-query.dto");
const integer_transformer_1 = require("../transformers/integer-transformer");
class SelectionDynamicQueryDto extends pagination_query_dto_1.PaginationQueryDto {
    constructor(fieldId, query, limit, offset) {
        super(limit, offset);
        this.query = '';
        this.optionValue = '';
        this.fieldId = fieldId;
        this.query = query;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { fieldId: { required: true, type: () => Number }, query: { required: false, type: () => String, default: "" }, optionValue: { required: false, type: () => String, default: "" } };
    }
}
exports.SelectionDynamicQueryDto = SelectionDynamicQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Field ID of the field against which the dynamic value provider is registered.", type: Number }),
    (0, class_validator_1.IsNumber)(),
    (0, class_transformer_1.Transform)(integer_transformer_1.default),
    __metadata("design:type", Number)
], SelectionDynamicQueryDto.prototype, "fieldId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Search query string", type: String }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SelectionDynamicQueryDto.prototype, "query", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Value of a single dynamic option", type: String }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SelectionDynamicQueryDto.prototype, "optionValue", void 0);
//# sourceMappingURL=selection-dynamic-query.dto.js.map