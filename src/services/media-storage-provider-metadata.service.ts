import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { Media } from "src/entities/media.entity";
import { MediaMigrationJob } from "src/entities/media-migration-job.entity";
import { MediaStorageProviderMetadataRepository } from "src/repository/media-storage-provider-metadata.repository";
import { DataSource, In, SelectQueryBuilder } from "typeorm";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { UpdateMediaStorageProviderMetadataDto } from "../dtos/update-media-storage-provider.dto";
import { MediaStorageProviderMetadata } from "../entities/media-storage-provider-metadata.entity";
import { CrudHelperService } from "./crud-helper.service";
import { describeProviderLocationChanges, findProviderLocationChanges } from "./media-storage-provider-changes";

@Injectable()
export class MediaStorageProviderMetadataService {
    private readonly logger = new Logger(MediaStorageProviderMetadataService.name);

    constructor(
        // @InjectRepository(MediaStorageProviderMetadata)
        // private readonly mediaStorageProviderRepo: Repository<MediaStorageProviderMetadata>,
        private readonly mediaStorageProviderRepo: MediaStorageProviderMetadataRepository,
        private readonly crudHelperService: CrudHelperService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Finds changes in `incoming` that would make files already stored on this provider
     * unreachable. Returns an empty list if nothing risky changes or the provider holds no media.
     */
    private async findBlockedLocationChanges(existing: MediaStorageProviderMetadata, incoming: Record<string, any>) {
        const changes = findProviderLocationChanges(existing, incoming);
        if (changes.length === 0) {
            return { changes, mediaCount: 0 };
        }

        const mediaCount = await this.dataSource.getRepository(Media).count({
            where: { mediaStorageProviderMetadata: { id: existing.id } },
        });
        return { changes: mediaCount > 0 ? changes : [], mediaCount };
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
            // The seeder calls this on every run. Throwing here would stop seeding for the whole
            // module, so keep the stored location settings and warn instead.
            const { changes, mediaCount } = await this.findBlockedLocationChanges(existingMediaStorageProvider, updateMediaStorageProviderDto);
            const safeDto = { ...updateMediaStorageProviderDto };
            for (const change of changes) {
                delete safeDto[change.field];
            }
            if (changes.length > 0) {
                this.logger.warn(
                    `Seed data differs from media storage provider "${existingMediaStorageProvider.name}" (${describeProviderLocationChanges(changes)}), ` +
                    `but it holds ${mediaCount} media files, so the stored values were kept.`
                );
            }
            const updatedMediaStorageProviderDto = { ...existingMediaStorageProvider, ...safeDto };
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
            const { changes, mediaCount } = await this.findBlockedLocationChanges(existing, updateMediaStorageProviderMetadataDto);
            if (changes.length > 0) {
                throw new BadRequestException(
                    `Media storage provider "${existing.name}" has ${mediaCount} media files. Changing ${describeProviderLocationChanges(changes)} ` +
                    `would make them unreachable. Automatic media migration is coming soon; until then, leave this setting unchanged.`
                );
            }
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

    // Migration history keeps a link to its providers. Refuse the delete with a clear message
    // instead of letting the database reject it with a foreign key error.
    private async assertNoMigrationHistory(providerIds: number[]): Promise<void> {
        const jobCount = await this.dataSource.getRepository(MediaMigrationJob).count({
            where: [
                { sourceProvider: { id: In(providerIds) } },
                { targetProvider: { id: In(providerIds) } },
            ],
        });
        if (jobCount > 0) {
            throw new BadRequestException(
                `Cannot delete this media storage provider: it is used by ${jobCount} media migration job(s). ` +
                `Delete those migration jobs first, then delete the provider.`
            );
        }
    }

    async deleteMany(ids: number[]): Promise<any> {
        if (!ids || ids.length === 0) {
            throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
        }
        await this.assertNoMigrationHistory(ids);
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
        await this.assertNoMigrationHistory([id]);
        return this.mediaStorageProviderRepo.remove(lov);
    }
}