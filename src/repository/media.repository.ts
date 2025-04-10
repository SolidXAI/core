import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Media } from 'src/entities/media.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';

@Injectable()
export class MediaRepository extends Repository<Media> {
    constructor(
        private dataSource: DataSource,
        @InjectRepository(ModelMetadata)
        private readonly modelMetadataRepo: Repository<ModelMetadata>,
        @InjectRepository(MediaStorageProviderMetadata)
        private readonly mediaStorageProviderMetadataRepo: Repository<MediaStorageProviderMetadata>,
        @InjectRepository(FieldMetadata)
        private readonly fieldMetadataRepo: Repository<FieldMetadata>,

    ) {
        super(Media, dataSource.createEntityManager());
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
