import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { MediaStorageProviderMetadataService } from 'src/services/media-storage-provider-metadata.service';
import { ConfigService } from '@nestjs/config';
import { MediaService } from 'src/services/media.service';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';


import { ExportTemplate } from '../entities/export-template.entity';

@Injectable()
export class ExportTemplateService extends CRUDService<ExportTemplate>{
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
    @InjectRepository(ExportTemplate, 'default')
    readonly repo: Repository<ExportTemplate>,
 ) {
   super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService,entityManager, repo, 'exportTemplate', 'solid-core');
 }
}
