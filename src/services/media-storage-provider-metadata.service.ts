import { Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { MediaStorageProviderMetadataRepository } from "src/repository/media-storage-provider-metadata.repository";
import { SelectQueryBuilder } from "typeorm";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { UpdateMediaStorageProviderMetadataDto } from "../dtos/update-media-storage-provider.dto";
import { MediaStorageProviderMetadata } from "../entities/media-storage-provider-metadata.entity";
import { CrudHelperService } from "./crud-helper.service";

@Injectable()
export class MediaStorageProviderMetadataService {
    constructor(
        // @InjectRepository(MediaStorageProviderMetadata)
        // private readonly mediaStorageProviderRepo: Repository<MediaStorageProviderMetadata>,
        private readonly mediaStorageProviderRepo: MediaStorageProviderMetadataRepository,
        private readonly crudHelperService: CrudHelperService
    ) { }

    async findMany(basicFilterDto: BasicFilterDto) {
        const alias = 'mediaStorageProviderMetadata';
        // Extract the required keys from the input query
        let { limit, offset, populateMedia } = basicFilterDto;

        // Create above query on pincode table using query builder
        var qb: SelectQueryBuilder<MediaStorageProviderMetadata> = await this.mediaStorageProviderRepo.createSecurityRuleAwareQueryBuilder(alias)
        qb = this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);

        // Get the records and the count
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
        return r
    }

    async findOne(id: number, relations = {}) {
        const lov = await this.mediaStorageProviderRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!lov) {
            throw new NotFoundException(`Media Storage Provider with #${id} not found`);
        }
        return lov;
    }

    async findOneByUserKey(name: string, relations = {}) {
        const lov = await this.mediaStorageProviderRepo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        // if (!lov) {
        //     throw new NotFoundException(`Media Storage Provider with #${name} not found`);
        // }
        return lov;
    }

    async findOnebyType(type: string, relations = {}) {
        const lov = await this.mediaStorageProviderRepo.findOne({
            where: {
                type: type,
            },
            relations: relations,
        });
        if (!lov) {
            throw new NotFoundException(ERROR_MESSAGES.MEDIA_STORAGE_PROVIDER_ID_NOT_FOUND(type));
        }
        return lov;
    }

    async create(createDto: any) {
        const lov = this.mediaStorageProviderRepo.create(createDto);
        return this.mediaStorageProviderRepo.save(lov);
    }

    async upsert(updateMediaStorageProviderDto: any) {
        // First check if module already exists using name
        const existingMediaStorageProvider = await this.mediaStorageProviderRepo.findOne({
            where: {
                name: updateMediaStorageProviderDto.name
            }
        })

        // if found
        if (existingMediaStorageProvider) {
            const updatedMediaStorageProviderDto = { ...existingMediaStorageProvider, ...updateMediaStorageProviderDto };
            return this.mediaStorageProviderRepo.save(updatedMediaStorageProviderDto);
        }
        // if not found - create new 
        else {
            const moduleMetadata = this.mediaStorageProviderRepo.create(updateMediaStorageProviderDto);
            return this.mediaStorageProviderRepo.save(moduleMetadata);
        }
    }

    async update(id: number, updateMediaStorageProviderMetadataDto: UpdateMediaStorageProviderMetadataDto) {

        const entity = await this.mediaStorageProviderRepo.preload({
            id,
            ...updateMediaStorageProviderMetadataDto,
        });

        if (!entity) {
            throw new NotFoundException(ERROR_MESSAGES.MODULE_ID_NOT_FOUND(id));
        }
        return this.mediaStorageProviderRepo.save(entity);
    }

    async deleteMany(ids: number[]): Promise<any> {
        if (!ids || ids.length === 0) {
            throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
        }
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]
            const entity = await this.mediaStorageProviderRepo.findOne({
                where: {
                    //@ts-ignore
                    id: id,
                }
            });
            // if (!entity) {
            //     throw new Error(`Entity with id ${id} not found`);
            // }
            removedEntities.push(await this.mediaStorageProviderRepo.remove(entity));
        }

        return removedEntities
    }

    async delete(id: number) {
        const lov = await this.findOne(id);
        return this.mediaStorageProviderRepo.remove(lov);
    }
}