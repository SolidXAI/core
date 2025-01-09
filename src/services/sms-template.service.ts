import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { SmsTemplate } from '../entities/sms-template.entity';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dtos/update-sms-template.dto';

@Injectable()
export class SmsTemplateService {
    constructor(
        @InjectRepository(SmsTemplate)
        private readonly smsTemplateRepo: Repository<SmsTemplate>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
    ) { }

    create(createSmsTemplateDto: CreateSmsTemplateDto) {
        const entity = this.smsTemplateRepo.create(createSmsTemplateDto);
        return this.smsTemplateRepo.save(entity);
    }

    async findOneByName(name: string) {
        const entity = await this.smsTemplateRepo.findOne({
            where: {
                name: name,
            },
        });
        return entity;
    }

    async findAll(paginationQuery: PaginationQueryDto) {
        const { limit, offset } = paginationQuery;

        return await this.smsTemplateRepo.find({
            skip: offset,
            take: limit,
        });
    }

    async findOne(id: number) {
        const entity = await this.smsTemplateRepo.findOne({
            where: {
                id: id,
            },
        });
        if (!entity) {
            throw new NotFoundException(`Sms template #${id} not found`);
        }
        return entity;
    }

    async update(id: number, updateSmsTemplateDto: UpdateSmsTemplateDto) {
        const entity = await this.smsTemplateRepo.preload({
            id,
            ...updateSmsTemplateDto,
        });
        if (!entity) {
            throw new NotFoundException(`Sms template #${id} not found`);
        }
        return this.smsTemplateRepo.save(entity);
    }

    async removeByName(name: string) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.smsTemplateRepo.remove(entity);
        }
    }

    async remove(id: number) {
        const entity = await this.findOne(id);
        return this.smsTemplateRepo.remove(entity);
    }

}
