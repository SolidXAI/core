import { PermissionMetadataService } from '../services/permission-metadata.service';
import { CreatePermissionMetadataDto } from '../dtos/create-permission-metadata.dto';
import { UpdatePermissionMetadataDto } from '../dtos/update-permission-metadata.dto';
export declare class PermissionMetadataController {
    private readonly service;
    constructor(service: PermissionMetadataService);
    create(createDto: CreatePermissionMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").PermissionMetadata>;
    insertMany(createDtos: CreatePermissionMetadataDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").PermissionMetadata[]>;
    update(id: number, updateDto: UpdatePermissionMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").PermissionMetadata>;
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
        records: import("..").PermissionMetadata[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findOne(id: string, query: any): Promise<import("..").PermissionMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").PermissionMetadata>;
}
