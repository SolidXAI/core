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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldMetadataController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const field_metadata_service_1 = require("../services/field-metadata.service");
const basic_filters_dto_1 = require("../dtos/basic-filters.dto");
const selection_dynamic_query_dto_1 = require("../dtos/selection-dynamic-query.dto");
let FieldMetadataController = class FieldMetadataController {
    constructor(fieldMetadataService) {
        this.fieldMetadataService = fieldMetadataService;
    }
    async findMany(basicFilterDto) {
        return this.fieldMetadataService.findMany(basicFilterDto);
    }
    async findFieldDefaultMetaData() {
        return this.fieldMetadataService.findFieldDefaultMetaData();
    }
    async getSelectionDynamicValues(query) {
        return this.fieldMetadataService.getSelectionDynamicValues(query);
    }
    async getSelectionDynamicValue(query) {
        return this.fieldMetadataService.getSelectionDynamicValue(query);
    }
    findOne(id, query) {
        return this.fieldMetadataService.findOne(id, query);
    }
    create(createDtos) {
        return Promise.all(createDtos.map(dto => this.fieldMetadataService.create(dto)));
    }
    remove(id) {
        return this.fieldMetadataService.remove(id);
    }
};
exports.FieldMetadataController = FieldMetadataController;
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'fields', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'sort', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'groupBy', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'populate', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'populateMedia', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'filters', required: false, type: Array }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [basic_filters_dto_1.BasicFilterDto]),
    __metadata("design:returntype", Promise)
], FieldMetadataController.prototype, "findMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)('/default'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FieldMetadataController.prototype, "findFieldDefaultMetaData", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)('/selection-dynamic-values'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [selection_dynamic_query_dto_1.SelectionDynamicQueryDto]),
    __metadata("design:returntype", Promise)
], FieldMetadataController.prototype, "getSelectionDynamicValues", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)('/selection-dynamic-value'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [selection_dynamic_query_dto_1.SelectionDynamicQueryDto]),
    __metadata("design:returntype", Promise)
], FieldMetadataController.prototype, "getSelectionDynamicValue", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/field-metadata.entity").FieldMetadata }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], FieldMetadataController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: [require("../entities/field-metadata.entity").FieldMetadata] }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], FieldMetadataController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/field-metadata.entity").FieldMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FieldMetadataController.prototype, "remove", null);
exports.FieldMetadataController = FieldMetadataController = __decorate([
    (0, common_1.Controller)('field-metadata'),
    (0, swagger_1.ApiTags)("App Builder"),
    __metadata("design:paramtypes", [field_metadata_service_1.FieldMetadataService])
], FieldMetadataController);
//# sourceMappingURL=field-metadata.controller.js.map