import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Media } from 'src/entities/media.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource, In } from 'typeorm';
import { FieldMetadataRepository } from './field-metadata.repository';
import { MediaStorageProviderMetadataRepository } from './media-storage-provider-metadata.repository';
import { ModelMetadataRepository } from './model-metadata.repository';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MediaRepository extends SolidBaseRepository<Media> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
        // @InjectRepository(FieldMetadata)
        // private readonly fieldMetadataRepo: Repository<FieldMetadata>,
        // @InjectRepository(ModelMetadata)
        // private readonly modelMetadataRepo: Repository<ModelMetadata>,
        // @InjectRepository(MediaStorageProviderMetadata)
        // private readonly mediaStorageProviderMetadataRepo: Repository<MediaStorageProviderMetadata>,
        private readonly fieldMetadataRepo: FieldMetadataRepository,
        @Inject(forwardRef(() => ModelMetadataRepository))
        private readonly modelMetadataRepo: ModelMetadataRepository,
        private readonly mediaStorageProviderMetadataRepo: MediaStorageProviderMetadataRepository,
    ) {
        super(Media, dataSource, requestContextService, securityRuleRepository);
    }

    async createMedia(createDto: any) {
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
        const media = this.create(createDto);
        return this.save(media);
    }

    async findByEntityIdAndFieldIdAndModelMetadataId(entityId: number, fieldMetadataId: number, modelMetadataId: number, relations = {}) {
        return await this.find({
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

    async deleteByEntityIdAndFieldIdAndModelMetadataId(entityId: number, fieldMetadataId: number, modelMetadataId: number) {
        const entities = await this.find({
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
        return this.remove(entities);
    }

}
