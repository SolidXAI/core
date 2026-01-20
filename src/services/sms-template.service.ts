import { Injectable } from '@nestjs/common';

import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { SmsTemplateRepository } from 'src/repository/sms-template.repository';
import { EntityManager } from 'typeorm';
import { SmsTemplate } from '../entities/sms-template.entity';
import { CRUDService } from './crud.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { MediaService } from './media.service';

@Injectable()
export class SmsTemplateService extends CRUDService<SmsTemplate>{
    constructor(
            readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
            readonly mediaService: MediaService,
            @InjectEntityManager()
            readonly entityManager: EntityManager,
            // @InjectRepository(SmsTemplate, 'default')
            // readonly repo: Repository<SmsTemplate>,
            readonly repo: SmsTemplateRepository,
            readonly moduleRef: ModuleRef,
    ) {
        super(entityManager, repo, 'smsTemplate', 'app-builder', moduleRef);
     }

    async removeByName(name: string) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.repo.remove(entity);
        }
    }

    async findOneByName(name: string) {
        const entity = await this.repo.findOne({
            where: {
                name: name,
            },
        });
        return entity;
    }
}
