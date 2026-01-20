import { Injectable } from '@nestjs/common';

import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EmailTemplateRepository } from 'src/repository/email-template.repository';
import { EntityManager } from 'typeorm';
import { EmailTemplate } from '../entities/email-template.entity';
import { CRUDService } from './crud.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { MediaService } from './media.service';

@Injectable()
export class EmailTemplateService extends CRUDService<EmailTemplate>{
    constructor(
    readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
    readonly mediaService: MediaService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(EmailTemplate, 'default')
    // readonly repo: Repository<EmailTemplate>,
    readonly repo: EmailTemplateRepository,
    readonly moduleRef: ModuleRef,
    ) {
        super(entityManager, repo, 'emailTemplate', 'app-builder', moduleRef);
    }
    async findOneByName(name: string, relations: any = {}) {
        const entity = await this.repo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return entity;
    }
    async removeByName(name: string) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.repo.remove(entity);
        }
    }
}
