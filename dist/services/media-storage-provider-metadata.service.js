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
exports.MediaStorageProviderMetadataService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const media_storage_provider_metadata_entity_1 = require("../entities/media-storage-provider-metadata.entity");
const crud_helper_service_1 = require("./crud-helper.service");
let MediaStorageProviderMetadataService = class MediaStorageProviderMetadataService {
    constructor(mediaStorageProviderRepo, crudHelperService) {
        this.mediaStorageProviderRepo = mediaStorageProviderRepo;
        this.crudHelperService = crudHelperService;
    }
    async findMany(basicFilterDto) {
        const alias = 'mediaStorageProviderMetadata';
        let { limit, offset, populateMedia } = basicFilterDto;
        var qb = this.mediaStorageProviderRepo.createQueryBuilder(alias);
        qb = await this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);
        const [entities, count] = await qb.getManyAndCount();
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(count / limit);
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;
        const prevPage = currentPage > 1 ? currentPage - 1 : null;
        const r = {
            meta: {
                totalRecords: count,
                currentPage: currentPage,
                nextPage: nextPage,
                prevPage: prevPage,
                totalPages: totalPages,
                perPage: +limit,
            },
            records: entities
        };
        return r;
    }
    async findOne(id, relations = {}) {
        const lov = await this.mediaStorageProviderRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!lov) {
            throw new common_1.NotFoundException(`Media Storage Provider with #${id} not found`);
        }
        return lov;
    }
    async findOneByUserKey(name, relations = {}) {
        const lov = await this.mediaStorageProviderRepo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return lov;
    }
    async findOnebyType(type, relations = {}) {
        const lov = await this.mediaStorageProviderRepo.findOne({
            where: {
                type: type,
            },
            relations: relations,
        });
        if (!lov) {
            throw new common_1.NotFoundException(`Media Storage Provider with #${type} not found`);
        }
        return lov;
    }
    async create(createDto) {
        const lov = this.mediaStorageProviderRepo.create(createDto);
        return this.mediaStorageProviderRepo.save(lov);
    }
    async upsert(updateMediaStorageProviderDto) {
        const existingMediaStorageProvider = await this.mediaStorageProviderRepo.findOne({
            where: {
                name: updateMediaStorageProviderDto.name
            }
        });
        if (existingMediaStorageProvider) {
            const updatedMediaStorageProviderDto = { ...existingMediaStorageProvider, ...updateMediaStorageProviderDto };
            return this.mediaStorageProviderRepo.save(updatedMediaStorageProviderDto);
        }
        else {
            const moduleMetadata = this.mediaStorageProviderRepo.create(updateMediaStorageProviderDto);
            return this.mediaStorageProviderRepo.save(moduleMetadata);
        }
    }
    async update(id, updateMediaStorageProviderMetadataDto) {
        const entity = await this.mediaStorageProviderRepo.preload({
            id,
            ...updateMediaStorageProviderMetadataDto,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`Module ${id} not found`);
        }
        return this.mediaStorageProviderRepo.save(entity);
    }
    async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            throw new Error('At least one ID is required for deletion');
        }
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const entity = await this.mediaStorageProviderRepo.findOne({
                where: {
                    id: id,
                }
            });
            removedEntities.push(await this.mediaStorageProviderRepo.remove(entity));
        }
        return removedEntities;
    }
    async remove(id) {
        const lov = await this.findOne(id);
        return this.mediaStorageProviderRepo.remove(lov);
    }
};
exports.MediaStorageProviderMetadataService = MediaStorageProviderMetadataService;
exports.MediaStorageProviderMetadataService = MediaStorageProviderMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        crud_helper_service_1.CrudHelperService])
], MediaStorageProviderMetadataService);
//# sourceMappingURL=media-storage-provider-metadata.service.js.map