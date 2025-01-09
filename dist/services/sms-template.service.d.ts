import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { SmsTemplate } from '../entities/sms-template.entity';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dtos/update-sms-template.dto';
export declare class SmsTemplateService {
    private readonly smsTemplateRepo;
    private readonly entityManager;
    constructor(smsTemplateRepo: Repository<SmsTemplate>, entityManager: EntityManager);
    create(createSmsTemplateDto: CreateSmsTemplateDto): Promise<SmsTemplate>;
    findOneByName(name: string): Promise<SmsTemplate>;
    findAll(paginationQuery: PaginationQueryDto): Promise<SmsTemplate[]>;
    findOne(id: number): Promise<SmsTemplate>;
    update(id: number, updateSmsTemplateDto: UpdateSmsTemplateDto): Promise<SmsTemplate>;
    removeByName(name: string): Promise<SmsTemplate>;
    remove(id: number): Promise<SmsTemplate>;
}
