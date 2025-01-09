import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { UpdateModuleMetadataDto } from '../dtos/update-module-metadata.dto';
import { ModuleMetadataService } from '../services/module-metadata.service';
export declare class ModuleMetadataController {
    private readonly moduleMetadataService;
    constructor(moduleMetadataService: ModuleMetadataService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").ModuleMetadata[];
    }>;
    findOne(id: number): Promise<import("..").ModuleMetadata>;
    create(createDto: CreateModuleMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").ModuleMetadata>;
    refreshPermission(): Promise<boolean>;
    generateCode(id: number): Promise<string>;
    update(id: number, updateModuleMetadataDto: UpdateModuleMetadataDto, files: Array<Express.Multer.File>): Promise<import("..").ModuleMetadata>;
    deleteMany(ids: number[]): Promise<any>;
    remove(id: number): Promise<import("..").ModuleMetadata>;
}
