import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { UpdateModelMetaDataDto } from '../dtos/update-model-metadata.dto';
import { ModelMetadataService } from '../services/model-metadata.service';
export declare class ModelMetadataController {
    private readonly modelMetadataService;
    private logger;
    constructor(modelMetadataService: ModelMetadataService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").ModelMetadata[];
    }>;
    findManyPublic(): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").ModelMetadata[];
    }>;
    findOne(id: number, query: any): Promise<import("..").ModelMetadata>;
    create(createDto: CreateModelMetadataDto): Promise<import("..").ModelMetadata>;
    generateCode(id: number): Promise<string>;
    update(id: number, updateModelMetaDataDto: UpdateModelMetaDataDto): Promise<void>;
    deleteMany(ids: number[]): Promise<any>;
    remove(id: number): Promise<import("..").ModelMetadata>;
}
