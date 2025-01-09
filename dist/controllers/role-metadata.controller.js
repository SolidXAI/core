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
exports.RoleMetadataController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const role_metadata_service_1 = require("../services/role-metadata.service");
const create_role_metadata_dto_1 = require("../dtos/create-role-metadata.dto");
const update_role_metadata_dto_1 = require("../dtos/update-role-metadata.dto");
let RoleMetadataController = class RoleMetadataController {
    constructor(service) {
        this.service = service;
    }
    create(createDto, files) {
        return this.service.create(createDto, files);
    }
    insertMany(createDtos, filesArray = []) {
        return this.service.insertMany(createDtos, filesArray);
    }
    update(id, updateDto, files) {
        return this.service.update(id, updateDto, files);
    }
    async findMany(query) {
        return this.service.find(query);
    }
    async findOne(id, query) {
        return this.service.findOne(+id, query);
    }
    async deleteMany(ids) {
        return this.service.deleteMany(ids);
    }
    async delete(id) {
        return this.service.delete(id);
    }
};
exports.RoleMetadataController = RoleMetadataController;
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    openapi.ApiResponse({ status: 201, type: require("../entities/role-metadata.entity").RoleMetadata }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_role_metadata_dto_1.CreateRoleMetadataDto, Array]),
    __metadata("design:returntype", void 0)
], RoleMetadataController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)('/bulk'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    openapi.ApiResponse({ status: 201, type: [require("../entities/role-metadata.entity").RoleMetadata] }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Array]),
    __metadata("design:returntype", void 0)
], RoleMetadataController.prototype, "insertMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Put)(':id'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    openapi.ApiResponse({ status: 200, type: require("../entities/role-metadata.entity").RoleMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_role_metadata_dto_1.UpdateRoleMetadataDto, Array]),
    __metadata("design:returntype", void 0)
], RoleMetadataController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, swagger_1.ApiQuery)({ name: 'showSoftDeleted', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'showOnlySoftDeleted', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'fields', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'sort', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'groupBy', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'populate', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'populateMedia', required: false, type: Array }),
    (0, swagger_1.ApiQuery)({ name: 'filters', required: false, type: Array }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoleMetadataController.prototype, "findMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/role-metadata.entity").RoleMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoleMetadataController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)('/bulk'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], RoleMetadataController.prototype, "deleteMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/role-metadata.entity").RoleMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RoleMetadataController.prototype, "delete", null);
exports.RoleMetadataController = RoleMetadataController = __decorate([
    (0, swagger_1.ApiTags)('Solid'),
    (0, common_1.Controller)('role-metadata'),
    __metadata("design:paramtypes", [role_metadata_service_1.RoleMetadataService])
], RoleMetadataController);
//# sourceMappingURL=role-metadata.controller.js.map