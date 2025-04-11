import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { EmailTemplate } from '../entities/email-template.entity';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';
import { CRUDService } from './crud.service';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataService } from './module-metadata.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from './file.service';
import { MediaService } from './media.service';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { CrudHelperService } from './crud-helper.service';

@Injectable()
export class EmailTemplateService extends CRUDService<EmailTemplate>{
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
    @InjectRepository(EmailTemplate, 'default')
    readonly repo: Repository<EmailTemplate>,
    readonly moduleRef: ModuleRef,
    ) {
        super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'emailTemplate', 'app-builder', moduleRef);
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
