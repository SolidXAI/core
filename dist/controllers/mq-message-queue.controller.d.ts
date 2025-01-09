import { CreateMqMessageQueueDto } from '../dtos/create-mq-message-queue.dto';
import { UpdateMqMessageQueueDto } from '../dtos/update-mq-message-queue.dto';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
export declare class MqMessageQueueController {
    protected readonly service: MqMessageQueueService;
    constructor(service: MqMessageQueueService);
    create(createDto: CreateMqMessageQueueDto, files: Array<Express.Multer.File>): Promise<import("..").MqMessageQueue>;
    insertMany(createDtos: CreateMqMessageQueueDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").MqMessageQueue[]>;
    update(id: number, updateDto: UpdateMqMessageQueueDto, files: Array<Express.Multer.File>): Promise<import("..").MqMessageQueue>;
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
        records: import("..").MqMessageQueue[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    findOne(id: string, query: any): Promise<import("..").MqMessageQueue>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").MqMessageQueue>;
}
