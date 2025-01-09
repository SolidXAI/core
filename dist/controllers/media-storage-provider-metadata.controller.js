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
var MediaStorageProviderMetadataController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaStorageProviderMetadataController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const create_media_storage_provider_metadata_dto_1 = require("../dtos/create-media-storage-provider-metadata.dto");
const media_storage_provider_metadata_service_1 = require("../services/media-storage-provider-metadata.service");
const basic_filters_dto_1 = require("../dtos/basic-filters.dto");
const update_media_storage_provider_dto_1 = require("../dtos/update-media-storage-provider.dto");
let MediaStorageProviderMetadataController = MediaStorageProviderMetadataController_1 = class MediaStorageProviderMetadataController {
    constructor(mediaStorageProviderService) {
        this.mediaStorageProviderService = mediaStorageProviderService;
        this.logger = new common_1.Logger(MediaStorageProviderMetadataController_1.name);
    }
    async findMany(basicFilterDto) {
        return this.mediaStorageProviderService.findMany(basicFilterDto);
    }
    findOne(id) {
        return this.mediaStorageProviderService.findOne(id);
    }
    create(createDto) {
        return this.mediaStorageProviderService.create(createDto);
    }
    update(id, updateMediaStorageProviderMetadataDto) {
        return this.mediaStorageProviderService.update(id, updateMediaStorageProviderMetadataDto);
    }
    async deleteMany(ids) {
        return this.mediaStorageProviderService.deleteMany(ids);
    }
    remove(id) {
        return this.mediaStorageProviderService.remove(id);
    }
};
exports.MediaStorageProviderMetadataController = MediaStorageProviderMetadataController;
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
], MediaStorageProviderMetadataController.prototype, "findMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/media-storage-provider-metadata.entity").MediaStorageProviderMetadata }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], MediaStorageProviderMetadataController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: [require("../entities/media-storage-provider-metadata.entity").MediaStorageProviderMetadata] }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_media_storage_provider_metadata_dto_1.CreateMediaStorageProviderMetadataDto]),
    __metadata("design:returntype", void 0)
], MediaStorageProviderMetadataController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/media-storage-provider-metadata.entity").MediaStorageProviderMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_media_storage_provider_dto_1.UpdateMediaStorageProviderMetadataDto]),
    __metadata("design:returntype", void 0)
], MediaStorageProviderMetadataController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)('/bulk'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], MediaStorageProviderMetadataController.prototype, "deleteMany", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/media-storage-provider-metadata.entity").MediaStorageProviderMetadata }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], MediaStorageProviderMetadataController.prototype, "remove", null);
exports.MediaStorageProviderMetadataController = MediaStorageProviderMetadataController = MediaStorageProviderMetadataController_1 = __decorate([
    (0, common_1.Controller)('media-storage-provider-metadata'),
    (0, swagger_1.ApiTags)("App Builder"),
    __metadata("design:paramtypes", [media_storage_provider_metadata_service_1.MediaStorageProviderMetadataService])
], MediaStorageProviderMetadataController);
//# sourceMappingURL=media-storage-provider-metadata.controller.js.map