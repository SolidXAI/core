import { Injectable } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
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
import { ExportTransaction } from 'src/entities/export-transaction.entity';
import { Readable } from 'stream';
import { ExportTemplate } from '../entities/export-template.entity';
import { ExportTransactionFileInfo, ExportTransactionService } from './export-transaction.service';

@Injectable()
export class ExportTemplateService extends CRUDService<ExportTemplate>{
  async startExportSync(id: number, filters:any): Promise<ExportTransactionFileInfo> {
    // Create the export transaction entry, with status 'started'
    const exportTransaction: CreateExportTransactionDto =  await this.exportTransactionService.toDto({
      datetime: new Date(),
      status: 'started',
      exportTemplateId: id,
    });
    const exportTransactionEntity = await this.exportTransactionService.create(exportTransaction);

    // Trigger the export process
    const exportFileInfo = await this.exportTransactionService.triggerExportSync(exportTransactionEntity.id, filters);
    // It should return the export transaction id
    return exportFileInfo;
  }

  async startExportAsync(id: number, filters:any): Promise<ExportTransaction>{
    // Create the export transaction entry, with status 'started'
    const exportTransaction: CreateExportTransactionDto =  await this.exportTransactionService.toDto({
      datetime: new Date(),
      status: 'started',
      exportTemplateId: id,
    });
    const exportTransactionEntity = await this.exportTransactionService.create(exportTransaction);

    // Trigger the export process
    this.exportTransactionService.triggerExportAsync(exportTransactionEntity.id, filters);

    // It should return the export transaction id, so client can use this to check the status
    return exportTransactionEntity;
  }

  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ExportTemplate, 'default')
    readonly repo: Repository<ExportTemplate>,
    readonly exportTransactionService: ExportTransactionService,
    readonly moduleRef: ModuleRef
 ) {
   super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService,entityManager, repo, 'exportTemplate', 'solid-core',moduleRef);
 }
}
