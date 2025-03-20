import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { SmsTemplate } from '../entities/sms-template.entity';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dtos/update-sms-template.dto';
import { CRUDService } from './crud.service';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataService } from './module-metadata.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from './file.service';
import { MediaService } from './media.service';
import { DiscoveryService } from '@nestjs/core';
import { CrudHelperService } from './crud-helper.service';

@Injectable()
export class SmsTemplateService extends CRUDService<SmsTemplate>{
    constructor(
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
            @InjectRepository(SmsTemplate, 'default')
            readonly repo: Repository<SmsTemplate>,
    ) {
        super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'smsTemplate', 'app-builder');
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
