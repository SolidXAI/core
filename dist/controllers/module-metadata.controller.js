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
exports.ModuleMetadataController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const basic_filters_dto_1 = require("../dtos/basic-filters.dto");
const create_module_metadata_dto_1 = require("../dtos/create-module-metadata.dto");
const update_module_metadata_dto_1 = require("../dtos/update-module-metadata.dto");
const module_metadata_service_1 = require("../services/module-metadata.service");
const platform_express_1 = require("@nestjs/platform-express");
let ModuleMetadataController = class ModuleMetadataController {
    constructor(moduleMetadataService) {
        this.moduleMetadataService = moduleMetadataService;
    }
    async findMany(basicFilterDto) {
        return this.moduleMetadataService.findMany(basicFilterDto);
    }
    findOne(id) {
        return this.moduleMetadataService.findOne(id);
    }
    create(createDto, files) {
        return this.moduleMetadataService.create(createDto, files);
    }
    refreshPermission() {
        return this.moduleMetadataService.refreshPermission();
    }
    generateCode(id) {
        return this.moduleMetadataService.generateCode({ moduleId: id });
    }
    update(id, updateModuleMetadataDto, files) {
        return this.moduleMetadataService.update(id, updateModuleMetadataDto, files);
    }
    async deleteMany(ids) {
        return this.moduleMetadataService.deleteMany(ids);
    }
    remove(id) {
        return this.moduleMetadataService.remove(id);
    }
};
exports.ModuleMetadataController = ModuleMetadataController;
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
], ModuleMetadataController.prototype, "findMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/module-metadata.entity").ModuleMetadata }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ModuleMetadataController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    openapi.ApiResponse({ status: 201, type: require("../entities/module-metadata.entity").ModuleMetadata }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_module_metadata_dto_1.CreateModuleMetadataDto, Array]),
    __metadata("design:returntype", void 0)
], ModuleMetadataController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)('/refresh-permission'),
    openapi.ApiResponse({ status: 201, type: Boolean }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ModuleMetadataController.prototype, "refreshPermission", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(':id/generate-code'),
    openapi.ApiResponse({ status: 201, type: String }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ModuleMetadataController.prototype, "generateCode", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    openapi.ApiResponse({ status: 200, type: require("../entities/module-metadata.entity").ModuleMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_module_metadata_dto_1.UpdateModuleMetadataDto, Array]),
    __metadata("design:returntype", void 0)
], ModuleMetadataController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)('/bulk'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], ModuleMetadataController.prototype, "deleteMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/module-metadata.entity").ModuleMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ModuleMetadataController.prototype, "remove", null);
exports.ModuleMetadataController = ModuleMetadataController = __decorate([
    (0, common_1.Controller)('module-metadata'),
    (0, swagger_1.ApiTags)("App Builder"),
    __metadata("design:paramtypes", [module_metadata_service_1.ModuleMetadataService])
], ModuleMetadataController);
//# sourceMappingURL=module-metadata.controller.js.map