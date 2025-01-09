import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { EmailTemplateService } from '../services/email-template.service';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';
export declare class EmailTemplateController {
    private readonly emailTemplateService;
    constructor(emailTemplateService: EmailTemplateService);
    create(dto: CreateEmailTemplateDto): Promise<import("..").EmailTemplate>;
    findAll(paginationQuery: PaginationQueryDto): Promise<import("..").EmailTemplate[]>;
    findOne(id: string): Promise<import("..").EmailTemplate>;
    update(id: string, dto: UpdateEmailTemplateDto): Promise<import("..").EmailTemplate>;
    remove(id: string): Promise<import("..").EmailTemplate>;
    generateMailgenTemplate(templateType: string): any;
}
