import { Injectable } from '@nestjs/common';
import { DiscoveryService } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { MediaStorageProviderMetadataService } from 'src/services/media-storage-provider-metadata.service';
import { MediaService } from 'src/services/media.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { CreateExportTransactionDto } from 'src/dtos/create-export-transaction.dto';
import { ExportTemplate } from '../entities/export-template.entity';
import { ExportTransactionService } from './export-transaction.service';

@Injectable()
export class ExportTemplateService extends CRUDService<ExportTemplate>{
  async startExport(id: number) {
    // It should load the export template by id
    // const exportTemplate = this.findOne(id, { })

    // It should create the export transaction entry
    const exportTransaction: CreateExportTransactionDto =  await this.exportTransactionService.toDto({
      datetime: new Date(),
      status: 'started',
      exportTemplateId: id,
    });
    const exportTransactionEntity = await this.exportTransactionService.create(exportTransaction);

    // Trigger the export process
    this.exportTransactionService.triggerExport(exportTransactionEntity.id);

    // It should return the export transaction id
    return exportTransaction;
  }

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
    readonly exportTransactionService: ExportTransactionService,
 ) {
   super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService,entityManager, repo, 'exportTemplate', 'solid-core');
 }
}
