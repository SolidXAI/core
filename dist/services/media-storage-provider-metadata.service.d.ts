import { Repository } from "typeorm";
import { MediaStorageProviderMetadata } from "../entities/media-storage-provider-metadata.entity";
import { BasicFilterDto } from "../dtos/basic-filters.dto";
import { CrudHelperService } from "./crud-helper.service";
import { UpdateMediaStorageProviderMetadataDto } from "../dtos/update-media-storage-provider.dto";
export declare class MediaStorageProviderMetadataService {
    private readonly mediaStorageProviderRepo;
    private readonly crudHelperService;
    constructor(mediaStorageProviderRepo: Repository<MediaStorageProviderMetadata>, crudHelperService: CrudHelperService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: MediaStorageProviderMetadata[];
    }>;
    findOne(id: number, relations?: {}): Promise<MediaStorageProviderMetadata>;
    findOneByUserKey(name: string, relations?: {}): Promise<MediaStorageProviderMetadata>;
    findOnebyType(type: string, relations?: {}): Promise<MediaStorageProviderMetadata>;
    create(createDto: any): Promise<MediaStorageProviderMetadata[]>;
    upsert(updateMediaStorageProviderDto: any): Promise<any>;
    update(id: number, updateMediaStorageProviderMetadataDto: UpdateMediaStorageProviderMetadataDto): Promise<MediaStorageProviderMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    remove(id: number): Promise<MediaStorageProviderMetadata>;
}
