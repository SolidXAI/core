import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { SmsTemplateService } from '../services/sms-template.service';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dtos/update-sms-template.dto';
export declare class SmsTemplateController {
    private readonly smsTemplateService;
    constructor(smsTemplateService: SmsTemplateService);
    create(dto: CreateSmsTemplateDto): Promise<import("..").SmsTemplate>;
    findAll(paginationQuery: PaginationQueryDto): Promise<import("..").SmsTemplate[]>;
    findOne(id: string): Promise<import("..").SmsTemplate>;
    update(id: string, dto: UpdateSmsTemplateDto): Promise<import("..").SmsTemplate>;
    remove(id: string): Promise<import("..").SmsTemplate>;
}
