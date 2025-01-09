import { ActionMetadataService } from '../services/action-metadata.service';
import { CreateActionMetadataDto } from '../dtos/create-action-metadata.dto';
import { UpdateActionMetadataDto } from '../dtos/update-action-metadata.dto';
export declare class ActionMetadataController {
    private readonly service;
    constructor(service: ActionMetadataService);
    create(createDto: CreateActionMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").ActionMetadata>;
    insertMany(createDtos: CreateActionMetadataDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").ActionMetadata[]>;
    update(id: number, updateDto: UpdateActionMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").ActionMetadata>;
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
        records: import("..").ActionMetadata[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findOne(id: string, query: any): Promise<import("..").ActionMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").ActionMetadata>;
}
