import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { EmailTemplate } from '../entities/email-template.entity';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';
export declare class EmailTemplateService {
    private readonly emailTemplateRepo;
    private readonly entityManager;
    constructor(emailTemplateRepo: Repository<EmailTemplate>, entityManager: EntityManager);
    create(createEmailTemplateDto: CreateEmailTemplateDto): Promise<EmailTemplate>;
    findAll(paginationQuery: PaginationQueryDto): Promise<EmailTemplate[]>;
    findOneByName(name: string, relations?: any): Promise<EmailTemplate>;
    findOne(id: number): Promise<EmailTemplate>;
    update(id: number, updateEmailTemplateDto: UpdateEmailTemplateDto): Promise<EmailTemplate>;
    removeByName(name: string): Promise<EmailTemplate>;
    remove(id: number): Promise<EmailTemplate>;
}
