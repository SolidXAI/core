import { Repository } from "typeorm";
import { Media } from "../entities/media.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { MediaStorageProviderMetadata } from "../entities/media-storage-provider-metadata.entity";
import { FieldMetadata } from "../entities/field-metadata.entity";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { CrudHelperService } from "./crud-helper.service";
import { FileService } from "src/services/file.service";
import { ConfigService } from "@nestjs/config";
export declare class MediaService {
    private readonly mediaRepo;
    private readonly modelMetadataRepo;
    private readonly mediaStorageProviderMetadataRepo;
    private readonly fieldMetadataRepo;
    private readonly crudHelperService;
    readonly fileService: FileService;
    private readonly configService;
    constructor(mediaRepo: Repository<Media>, modelMetadataRepo: Repository<ModelMetadata>, mediaStorageProviderMetadataRepo: Repository<MediaStorageProviderMetadata>, fieldMetadataRepo: Repository<FieldMetadata>, crudHelperService: CrudHelperService, fileService: FileService, configService: ConfigService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: Media[];
    }>;
    findOne(id: number, relations?: {}): Promise<Media>;
    create(createDto: any): Promise<Media[]>;
    upload(createDto: any, files: Array<Express.Multer.File>): Promise<any[]>;
    deleteMany(ids: number[]): Promise<any>;
    remove(id: number): Promise<Media>;
    delete(id: number): Promise<Media>;
    findByEntityIdAndFieldIdAndModelMetadataId(entityId: number, fieldMetadataId: number, modelMetadataId: number, relations?: {}): Promise<Media[]>;
    deleteByEntityIdAndFieldIdAndModelMetadataId(entityId: number, fieldMetadataId: number, modelMetadataId: number): Promise<Media[]>;
    private getFileSysytemFullFilePath;
    private getAwsS3FullFilePath;
    private getFileName;
}
