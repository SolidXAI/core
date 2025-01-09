import { CreateMqMessageDto } from '../dtos/create-mq-message.dto';
import { UpdateMqMessageDto } from '../dtos/update-mq-message.dto';
import { MqMessageService } from '../services/mq-message.service';
export declare class MqMessageController {
    protected readonly service: MqMessageService;
    constructor(service: MqMessageService);
    create(createDto: CreateMqMessageDto, files: Array<Express.Multer.File>): Promise<import("..").MqMessage>;
    insertMany(createDtos: CreateMqMessageDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").MqMessage[]>;
    update(id: number, updateDto: UpdateMqMessageDto, files: Array<Express.Multer.File>): Promise<import("..").MqMessage>;
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
        records: import("..").MqMessage[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findOne(id: string, query: any): Promise<import("..").MqMessage>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").MqMessage>;
}
