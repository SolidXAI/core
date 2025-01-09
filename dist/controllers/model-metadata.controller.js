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
exports.ModelMetadataController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../decorators/public.decorator");
const basic_filters_dto_1 = require("../dtos/basic-filters.dto");
const create_model_metadata_dto_1 = require("../dtos/create-model-metadata.dto");
const update_model_metadata_dto_1 = require("../dtos/update-model-metadata.dto");
const model_metadata_service_1 = require("../services/model-metadata.service");
let ModelMetadataController = class ModelMetadataController {
    constructor(modelMetadataService) {
        this.modelMetadataService = modelMetadataService;
        this.logger = new common_1.Logger('ModelMetadataController');
    }
    async findMany(basicFilterDto) {
        return this.modelMetadataService.findMany(basicFilterDto);
    }
    async findManyPublic() {
        const basicFilterDto = {
            fields: ['singularName'],
            limit: 10000,
            offset: 0,
            filters: [],
            groupBy: [],
            populate: [],
            populateMedia: [],
            sort: []
        };
        return this.modelMetadataService.findMany(basicFilterDto);
    }
    findOne(id, query) {
        return this.modelMetadataService.findOne(id, query);
    }
    create(createDto) {
        return this.modelMetadataService.create(createDto);
    }
    generateCode(id) {
        return this.modelMetadataService.generateCode({ modelId: id });
    }
    update(id, updateModelMetaDataDto) {
        return this.modelMetadataService.update(id, updateModelMetaDataDto);
    }
    async deleteMany(ids) {
        return this.modelMetadataService.deleteMany(ids);
    }
    remove(id) {
        return this.modelMetadataService.remove(id);
    }
};
exports.ModelMetadataController = ModelMetadataController;
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
], ModelMetadataController.prototype, "findMany", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('public'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ModelMetadataController.prototype, "findManyPublic", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/model-metadata.entity").ModelMetadata }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ModelMetadataController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: require("../entities/model-metadata.entity").ModelMetadata }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_model_metadata_dto_1.CreateModelMetadataDto]),
    __metadata("design:returntype", void 0)
], ModelMetadataController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(':id/generate-code'),
    openapi.ApiResponse({ status: 201, type: String }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ModelMetadataController.prototype, "generateCode", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Put)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_model_metadata_dto_1.UpdateModelMetaDataDto]),
    __metadata("design:returntype", void 0)
], ModelMetadataController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)('/bulk'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], ModelMetadataController.prototype, "deleteMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/model-metadata.entity").ModelMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ModelMetadataController.prototype, "remove", null);
exports.ModelMetadataController = ModelMetadataController = __decorate([
    (0, common_1.Controller)('model-metadata'),
    (0, swagger_1.ApiTags)("App Builder"),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService])
], ModelMetadataController);
//# sourceMappingURL=model-metadata.controller.js.map