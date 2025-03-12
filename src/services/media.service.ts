import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { Media } from "../entities/media.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { MediaStorageProviderMetadata } from "../entities/media-storage-provider-metadata.entity";
import { FieldMetadata } from "../entities/field-metadata.entity";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { CrudHelperService } from "./crud-helper.service";
import { FileService } from "src/services/file.service";
import { ConfigService } from "@nestjs/config";
import { MediaStorageProviderType } from "../dtos/create-media-storage-provider-metadata.dto";
import { FileStorageProvider } from "./mediaStorageProviders/file-storage-provider";
import { FileS3StorageProvider } from "./mediaStorageProviders/file-s3-storage-provider";
import { getMediaStorageProvider } from "./mediaStorageProviders";

@Injectable()
export class MediaService {
    constructor(
        @InjectRepository(Media)
        private readonly mediaRepo: Repository<Media>,
        @InjectRepository(ModelMetadata)
        private readonly modelMetadataRepo: Repository<ModelMetadata>,
        @InjectRepository(MediaStorageProviderMetadata)
        private readonly mediaStorageProviderMetadataRepo: Repository<MediaStorageProviderMetadata>,
        @InjectRepository(FieldMetadata)
        private readonly fieldMetadataRepo: Repository<FieldMetadata>,
        private readonly crudHelperService: CrudHelperService,
        readonly fileService: FileService,
        // @Inject(radixConfig.KEY)
        // private readonly radixConfiguration: ConfigType<typeof radixConfig>,
        private readonly configService: ConfigService,
    ) { }

    async findMany(basicFilterDto: BasicFilterDto) {
        const alias = 'media';
        // Extract the required keys from the input query
        let { limit, offset } = basicFilterDto;

        // Create above query on pincode table using query builder
        var qb: SelectQueryBuilder<Media> = this.mediaRepo.createQueryBuilder(alias)
        qb = await this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);

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
        const lov = await this.mediaRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!lov) {
            throw new NotFoundException(`Media with #${id} not found`);
        }
        return lov;
    }

    async create(createDto: any) {
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

    async upload(createDto: any, files: Array<Express.Multer.File>) {

        if (!files) {
            throw new NotFoundException(`File Not Found`);

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
                case MediaStorageProviderType.Filesystem:
                    const fileStoragePath = this.getFileSysytemFullFilePath(this.getFileName(file));
                    await this.fileService.copyFile(file.path, fileStoragePath);
                    createDto['relativeUri'] = this.getFileName(file);
                    break;
                case MediaStorageProviderType.AwsS3:
                    const fileName = this.getFileName(file);
                    let awsFileUrl;
                    if (createDto.mediaStorageProviderMetadata.isPublic === true) {
                        awsFileUrl = await this.fileService.copyToS3(file.path, file.mimetype, fileName, createDto.mediaStorageProviderMetadata.bucketName,);
                    } else {
                        awsFileUrl = await this.fileService.copyToS3WithPublic(file.path, file.mimetype, fileName, createDto.mediaStorageProviderMetadata.bucketName,);
                    }
                    // createDto['relativeUri'] = this.getAwsS3FullFilePath(awsFileUrl, createDto.mediaStorageProviderMetadata.bucketName, createDto.mediaStorageProviderMetadata.region);
                    createDto['relativeUri'] = awsFileUrl
                    break;
                default:
                    break;
            }
            await this.fileService.deleteFile(file.path);

            const media = this.mediaRepo.create(createDto);
            const savedMedia = await this.mediaRepo.save(media);
            savedMedias.push(savedMedia)
        }
        return savedMedias
    }

    async deleteMany(ids: number[]): Promise<any> {
        if (!ids || ids.length === 0) {
            throw new Error('At least one ID is required for deletion');
        }
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]
            const entity = await this.modelMetadataRepo.findOne({
                where: {
                    //@ts-ignore
                    id: id,
                }
            });
            // if (!entity) {
            //     throw new Error(`Entity with id ${id} not found`);
            // }
            removedEntities.push(await this.modelMetadataRepo.remove(entity));
        }

        return removedEntities
    }

    async remove(id: number) {
        // const lov = await this.findOne(id);
        const media = await this.mediaRepo.findOne({
            where: {
                id: id,
            },
            relations: ['mediaStorageProviderMetadata', 'fieldMetadata', 'fieldMetadata.model','fieldMetadata.mediaStorageProvider'],
        });
        const modelEntity = await this.modelMetadataRepo.findOne({
            where: {
                id: media.entityId,
            }
        }
        );
        // if (media.mediaStorageProviderMetadata.type === 'filesystem') {
        //     const fileStorageProvider = new FileStorageProvider(this.configService, this.fileService, this);

        //     await fileStorageProvider.delete(media, media.fieldMetadata);

        // } else if (media.mediaStorageProviderMetadata.type === 'aws-s3') {
        //     const fileStorageProvider = new FileS3StorageProvider(this.configService, this.fileService, this);
        //     await fileStorageProvider.delete(media, media.fieldMetadata);

        // } else {
        // }
        const storageProviderType = media.mediaStorageProviderMetadata.type as MediaStorageProviderType;
        const storageProvider = getMediaStorageProvider(this.configService, this.fileService, this, storageProviderType);
        await storageProvider.delete(modelEntity, media.fieldMetadata);

        return this.mediaRepo.remove(media);
    }

    async delete(id: number) {
        if (!id) {
            throw new BadRequestException('Id is required for update');
        }
        const entity = await this.mediaRepo.findOne({
            where: {
                //@ts-ignore
                id: id,
            }
        });
        if (!entity) {
            throw new NotFoundException(`Entity with id ${id} not found`);
        }
        return this.mediaRepo.remove(entity);
    }

    // async deleteByEntityId(entityId: number) {
    //     if (!entityId) {
    //         throw new BadRequestException('Entity id is required for deletion');
    //     }
    //     const entities = await this.mediaRepo.find({
    //         where: {
    //             entityId: entityId,
    //         }
    //     });
    //     return this.mediaRepo.remove(entities);
    // }

    // async findByEntityId(entityId: number) {
    //     return this.mediaRepo.find({
    //         where: {
    //             entityId: entityId,
    //         }
    //     });
    // }

    async findByEntityIdAndFieldIdAndModelMetadataId(entityId: number, fieldMetadataId: number, modelMetadataId: number, relations = {}) {
        return await this.mediaRepo.find({
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

    //TODO: Move this to a app builder config

    private getFileSysytemFullFilePath(fileName: string): string {
        return `${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
    }


    private getAwsS3FullFilePath(awsMediaurl: string, bucketName: string, regionName: string): string {
        // https://lunarismedia.s3.ap-south-1.amazonaws.com/LUNARIS_CP_REGISTRATION_CREATIVE.jpg
        return `https://${bucketName}.s3.${regionName}.amazonaws.com/${awsMediaurl}`;
    }

    private getFileName(file: Express.Multer.File): string {
        return `${file.filename}-${file.originalname}`;
    }
}