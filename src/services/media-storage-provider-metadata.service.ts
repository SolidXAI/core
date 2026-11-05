import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { Media } from "src/entities/media.entity";
import { MediaStorageProviderMetadataRepository } from "src/repository/media-storage-provider-metadata.repository";
import { DataSource, SelectQueryBuilder } from "typeorm";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { UpdateMediaStorageProviderMetadataDto } from "../dtos/update-media-storage-provider.dto";
import { MediaStorageProviderMetadata } from "../entities/media-storage-provider-metadata.entity";
import { CrudHelperService } from "./crud-helper.service";

// Provider settings that decide where existing files are found. Changing any of them
// while files exist on the provider would make those files unreachable.
const LOCATION_FIELDS = ['type', 'bucketName', 'isPublic', 'region'] as const;

@Injectable()
export class MediaStorageProviderMetadataService {
    constructor(
        // @InjectRepository(MediaStorageProviderMetadata)
        // private readonly mediaStorageProviderRepo: Repository<MediaStorageProviderMetadata>,
        private readonly mediaStorageProviderRepo: MediaStorageProviderMetadataRepository,
        private readonly crudHelperService: CrudHelperService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Rejects a change to a location field of a provider that still has media rows.
     * Only fields present in `incoming` are compared, so partial updates and seeder upserts
     * that omit a field are not blocked.
     */
    private async assertSafeProviderChange(existing: MediaStorageProviderMetadata, incoming: Record<string, any>): Promise<void> {
        const changes = LOCATION_FIELDS
            .filter(field => field in incoming && incoming[field] !== undefined)
            .filter(field => this.normalizeLocationValue(field, existing[field]) !== this.normalizeLocationValue(field, incoming[field]))
            .map(field => `${field} from "${existing[field] ?? ''}" to "${incoming[field] ?? ''}"`);

        if (changes.length === 0) {
            return;
        }

        const mediaCount = await this.dataSource.getRepository(Media).count({
            where: { mediaStorageProviderMetadata: { id: existing.id } },
        });
        if (mediaCount === 0) {
            return;
        }

        throw new BadRequestException(
            `Media storage provider "${existing.name}" has ${mediaCount} media files. Changing ${changes.join(' and ')} ` +
            `would break them. Create a new provider with the new settings and move the files with the media migration API (POST /api/media-migration).`
        );
    }

    // Matches how the app reads these values: a missing isPublic counts as public.
    private normalizeLocationValue(field: typeof LOCATION_FIELDS[number], value: any): any {
        if (field === 'isPublic') {
            return value !== false;
        }
        return value ?? null;
    }

    async find(basicFilterDto: BasicFilterDto) {
        return this.findMany(basicFilterDto);
    }

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
            await this.assertSafeProviderChange(existingMediaStorageProvider, updateMediaStorageProviderDto);
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

        const existing = await this.mediaStorageProviderRepo.findOne({ where: { id } });
        if (existing) {
            await this.assertSafeProviderChange(existing, updateMediaStorageProviderMetadataDto);
        }

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