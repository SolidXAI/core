import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { SmsTemplateRepository } from 'src/repository/sms-template.repository';
import { EntityManager } from 'typeorm';
import { SmsTemplate } from '../entities/sms-template.entity';
import { CrudHelperService } from './crud-helper.service';
import { CRUDService } from './crud.service';
import { FileService } from './file.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { MediaService } from './media.service';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataService } from './module-metadata.service';

@Injectable()
export class SmsTemplateService extends CRUDService<SmsTemplate>{
    constructor(
        @Inject(forwardRef(() => ModelMetadataService))
        readonly modelMetadataService: ModelMetadataService,
            readonly moduleMetadataService: ModuleMetadataService,
            readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
            readonly configService: ConfigService,
            readonly fileService: FileService,
            readonly mediaService: MediaService,
            readonly discoveryService: DiscoveryService,
            readonly crudHelperService: CrudHelperService,
            @InjectEntityManager()
            readonly entityManager: EntityManager,
            // @InjectRepository(SmsTemplate, 'default')
            // readonly repo: Repository<SmsTemplate>,
            readonly repo: SmsTemplateRepository,
            readonly moduleRef: ModuleRef,
    ) {
        super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'smsTemplate', 'app-builder', moduleRef);
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
