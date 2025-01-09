import { CreateMediaStorageProviderMetadataDto } from '../dtos/create-media-storage-provider-metadata.dto';
import { MediaStorageProviderMetadataService } from '../services/media-storage-provider-metadata.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateMediaStorageProviderMetadataDto } from '../dtos/update-media-storage-provider.dto';
export declare class MediaStorageProviderMetadataController {
    private readonly mediaStorageProviderService;
    private logger;
    constructor(mediaStorageProviderService: MediaStorageProviderMetadataService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").MediaStorageProviderMetadata[];
    }>;
    findOne(id: number): Promise<import("..").MediaStorageProviderMetadata>;
    create(createDto: CreateMediaStorageProviderMetadataDto): Promise<import("..").MediaStorageProviderMetadata[]>;
    update(id: number, updateMediaStorageProviderMetadataDto: UpdateMediaStorageProviderMetadataDto): Promise<import("..").MediaStorageProviderMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    remove(id: number): Promise<import("..").MediaStorageProviderMetadata>;
}
