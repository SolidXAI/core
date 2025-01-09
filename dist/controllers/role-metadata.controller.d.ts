import { RoleMetadataService } from '../services/role-metadata.service';
import { CreateRoleMetadataDto } from '../dtos/create-role-metadata.dto';
import { UpdateRoleMetadataDto } from '../dtos/update-role-metadata.dto';
export declare class RoleMetadataController {
    private readonly service;
    constructor(service: RoleMetadataService);
    create(createDto: CreateRoleMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").RoleMetadata>;
    insertMany(createDtos: CreateRoleMetadataDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").RoleMetadata[]>;
    update(id: number, updateDto: UpdateRoleMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").RoleMetadata>;
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
        records: import("..").RoleMetadata[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findOne(id: string, query: any): Promise<import("..").RoleMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").RoleMetadata>;
}
