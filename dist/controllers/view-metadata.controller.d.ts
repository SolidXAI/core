import { ViewMetadataService } from '../services/view-metadata.service';
import { CreateViewMetadataDto } from '../dtos/create-view-metadata.dto';
import { UpdateViewMetadataDto } from '../dtos/update-view-metadata.dto';
export declare class ViewMetadataController {
    private readonly service;
    constructor(service: ViewMetadataService);
    create(createDto: CreateViewMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").ViewMetadata>;
    insertMany(createDtos: CreateViewMetadataDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").ViewMetadata[]>;
    update(id: number, updateDto: UpdateViewMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").ViewMetadata>;
    findMany(query: any): Promise<{
        groupMeta: any[];
        groupRecords: any[];
        meta?: undefined;
        records?: undefined;
    } | {
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").ViewMetadata[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findOne(id: string, query: any): Promise<import("..").ViewMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").ViewMetadata>;
    getLayout(query: any): Promise<{
        solidView: import("..").ViewMetadata;
        solidFieldsMetadata: {
            [k: string]: import("..").FieldMetadata;
        };
    }>;
}
