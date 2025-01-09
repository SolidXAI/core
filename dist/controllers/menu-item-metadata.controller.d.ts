import { MenuItemMetadataService } from '../services/menu-item-metadata.service';
import { CreateMenuItemMetadataDto } from '../dtos/create-menu-item-metadata.dto';
import { UpdateMenuItemMetadataDto } from '../dtos/update-menu-item-metadata.dto';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
export declare class MenuItemMetadataController {
    private readonly service;
    constructor(service: MenuItemMetadataService);
    create(createDto: CreateMenuItemMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").MenuItemMetadata>;
    insertMany(createDtos: CreateMenuItemMetadataDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").MenuItemMetadata[]>;
    update(id: number, updateDto: UpdateMenuItemMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").MenuItemMetadata>;
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
        records: import("..").MenuItemMetadata[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findUserMenus(activeUser: ActiveUserData): Promise<any[]>;
    findOne(id: string, query: any): Promise<import("..").MenuItemMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").MenuItemMetadata>;
}
