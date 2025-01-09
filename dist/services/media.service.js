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
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const media_entity_1 = require("../entities/media.entity");
const model_metadata_entity_1 = require("../entities/model-metadata.entity");
const media_storage_provider_metadata_entity_1 = require("../entities/media-storage-provider-metadata.entity");
const field_metadata_entity_1 = require("../entities/field-metadata.entity");
const crud_helper_service_1 = require("./crud-helper.service");
const file_service_1 = require("./file.service");
const config_1 = require("@nestjs/config");
const create_media_storage_provider_metadata_dto_1 = require("../dtos/create-media-storage-provider-metadata.dto");
let MediaService = class MediaService {
    constructor(mediaRepo, modelMetadataRepo, mediaStorageProviderMetadataRepo, fieldMetadataRepo, crudHelperService, fileService, configService) {
        this.mediaRepo = mediaRepo;
        this.modelMetadataRepo = modelMetadataRepo;
        this.mediaStorageProviderMetadataRepo = mediaStorageProviderMetadataRepo;
        this.fieldMetadataRepo = fieldMetadataRepo;
        this.crudHelperService = crudHelperService;
        this.fileService = fileService;
        this.configService = configService;
    }
    async findMany(basicFilterDto) {
        const alias = 'media';
        let { limit, offset } = basicFilterDto;
        var qb = this.mediaRepo.createQueryBuilder(alias);
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
        const lov = await this.mediaRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!lov) {
            throw new common_1.NotFoundException(`Media with #${id} not found`);
        }
        return lov;
    }
    async create(createDto) {
        createDto['fieldMetadata'] = await this.fieldMetadataRepo.findOne({
            where: {
                id: createDto['fieldMetadataId']
            },
        });
        createDto['modelMetadata'] = await this.modelMetadataRepo.findOne({
            where: {
                id: createDto['modelMetadataId']
            },
        });
        createDto['mediaStorageProviderMetadata'] = await this.mediaStorageProviderMetadataRepo.findOne({
            where: {
                id: createDto['mediaStorageProviderMetadataId']
            },
        });
        const media = this.mediaRepo.create(createDto);
        return this.mediaRepo.save(media);
    }
    async upload(createDto, files) {
        if (!files) {
            throw new common_1.NotFoundException(`File Not Found`);
        }
        const savedMedias = [];
        for (let i = 0; i < files.length; i++) {
            createDto['fieldMetadata'] = await this.fieldMetadataRepo.findOne({
                where: {
                    id: createDto['fieldMetadataId']
                },
            });
            createDto['modelMetadata'] = await this.modelMetadataRepo.findOne({
                where: {
                    id: createDto['modelMetadataId']
                },
            });
            createDto['mediaStorageProviderMetadata'] = await this.mediaStorageProviderMetadataRepo.findOne({
                where: {
                    id: createDto['mediaStorageProviderMetadataId']
                },
            });
            const file = files[i];
            switch (createDto.mediaStorageProviderMetadata.type) {
                case create_media_storage_provider_metadata_dto_1.MediaStorageProviderType.Filesystem:
                    const fileStoragePath = this.getFileSysytemFullFilePath(this.getFileName(file));
                    await this.fileService.copyFile(file.path, fileStoragePath);
                    createDto['relativeUri'] = this.getFileName(file);
                    break;
                case create_media_storage_provider_metadata_dto_1.MediaStorageProviderType.AwsS3:
                    const fileName = this.getFileName(file);
                    let awsFileUrl;
                    if (createDto.mediaStorageProviderMetadata.isPublic === true) {
                        awsFileUrl = await this.fileService.copyToS3(file.path, file.mimetype, fileName, createDto.mediaStorageProviderMetadata.bucketName);
                    }
                    else {
                        awsFileUrl = await this.fileService.copyToS3WithPublic(file.path, file.mimetype, fileName, createDto.mediaStorageProviderMetadata.bucketName);
                    }
                    createDto['relativeUri'] = awsFileUrl;
                    break;
                default:
                    break;
            }
            await this.fileService.deleteFile(file.path);
            const media = this.mediaRepo.create(createDto);
            const savedMedia = await this.mediaRepo.save(media);
            savedMedias.push(savedMedia);
        }
        return savedMedias;
    }
    async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            throw new Error('At least one ID is required for deletion');
        }
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const entity = await this.modelMetadataRepo.findOne({
                where: {
                    id: id,
                }
            });
            removedEntities.push(await this.modelMetadataRepo.remove(entity));
        }
        return removedEntities;
    }
    async remove(id) {
        const lov = await this.findOne(id);
        return this.mediaRepo.remove(lov);
    }
    async delete(id) {
        if (!id) {
            throw new common_1.BadRequestException('Id is required for update');
        }
        const entity = await this.mediaRepo.findOne({
            where: {
                id: id,
            }
        });
        if (!entity) {
            throw new common_1.NotFoundException(`Entity with id ${id} not found`);
        }
        return this.mediaRepo.remove(entity);
    }
    async findByEntityIdAndFieldIdAndModelMetadataId(entityId, fieldMetadataId, modelMetadataId, relations = {}) {
        return this.mediaRepo.find({
            where: {
                modelMetadata: {
                    id: modelMetadataId
                },
                fieldMetadata: {
                    id: fieldMetadataId
                },
                entityId: entityId,
            },
            relations: relations,
        });
    }
    async deleteByEntityIdAndFieldIdAndModelMetadataId(entityId, fieldMetadataId, modelMetadataId) {
        const entities = await this.mediaRepo.find({
            where: {
                modelMetadata: {
                    id: modelMetadataId
                },
                fieldMetadata: {
                    id: fieldMetadataId
                },
                entityId: entityId,
            }
        });
        return this.mediaRepo.remove(entities);
    }
    getFileSysytemFullFilePath(fileName) {
        return `${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
    }
    getAwsS3FullFilePath(awsMediaurl, bucketName, regionName) {
        return `https://${bucketName}.s3.${regionName}.amazonaws.com/${awsMediaurl}`;
    }
    getFileName(file) {
        return `${file.filename}-${file.originalname}`;
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(media_entity_1.Media)),
    __param(1, (0, typeorm_1.InjectRepository)(model_metadata_entity_1.ModelMetadata)),
    __param(2, (0, typeorm_1.InjectRepository)(media_storage_provider_metadata_entity_1.MediaStorageProviderMetadata)),
    __param(3, (0, typeorm_1.InjectRepository)(field_metadata_entity_1.FieldMetadata)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        crud_helper_service_1.CrudHelperService,
        file_service_1.FileService,
        config_1.ConfigService])
], MediaService);
//# sourceMappingURL=media.service.js.map