import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { EmailTemplate } from '../entities/email-template.entity';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';

@Injectable()
export class EmailTemplateService {
    constructor(
        @InjectRepository(EmailTemplate)
        private readonly emailTemplateRepo: Repository<EmailTemplate>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
    ) { }

    create(createEmailTemplateDto: CreateEmailTemplateDto) {
        const entity = this.emailTemplateRepo.create(createEmailTemplateDto);
        return this.emailTemplateRepo.save(entity);
    }

    async findAll(paginationQuery: PaginationQueryDto) {
        const { limit, offset } = paginationQuery;

        return await this.emailTemplateRepo.find({
            skip: offset,
            take: limit,
        });
    }

    async findOneByName(name: string, relations: any = {}) {
        const entity = await this.emailTemplateRepo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return entity;
    }

    async findOne(id: number) {
        const entity = await this.emailTemplateRepo.findOne({
            where: {
                id: id,
            },
        });
        if (!entity) {
            throw new NotFoundException(`Email template #${id} not found`);
        }
        return entity;
    }

    async update(id: number, updateEmailTemplateDto: UpdateEmailTemplateDto) {
        const t = {
            id,
            ...updateEmailTemplateDto,
        };

        const entity = await this.emailTemplateRepo.preload(t);
        if (!entity) {
            throw new NotFoundException(`Email template #${id} not found`);
        }
        return this.emailTemplateRepo.save(entity);
    }

    async removeByName(name: string) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.emailTemplateRepo.remove(entity);
        }
    }

    async remove(id: number) {
        const entity = await this.findOne(id);
        return this.emailTemplateRepo.remove(entity);
    }

}
