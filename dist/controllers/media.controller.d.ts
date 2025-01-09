import { MediaService } from '../services/media.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CreateMediaDto } from '../dtos/create-media.dto';
export declare class MediaController {
    private readonly mediaService;
    private logger;
    constructor(mediaService: MediaService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").Media[];
    }>;
    findOne(id: number): Promise<import("..").Media>;
    create(createDto: CreateMediaDto): Promise<import("..").Media[]>;
    upload(files: Array<Express.Multer.File>, createDto: CreateMediaDto): Promise<any[]>;
    deleteMany(ids: number[]): Promise<any>;
    remove(id: number): Promise<import("..").Media>;
}
