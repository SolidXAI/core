import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EmailTemplateRepository } from 'src/repository/email-template.repository';
import { EntityManager } from 'typeorm';
import { EmailTemplate } from '../entities/email-template.entity';
import { CrudHelperService } from './crud-helper.service';
import { CRUDService } from './crud.service';
import { FileService } from './file.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { MediaService } from './media.service';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataService } from './module-metadata.service';

@Injectable()
export class EmailTemplateService extends CRUDService<EmailTemplate>{
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
    // @InjectRepository(EmailTemplate, 'default')
    // readonly repo: Repository<EmailTemplate>,
    readonly repo: EmailTemplateRepository,
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
