import { Injectable, Logger } from '@nestjs/common';
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


import { classify } from '@angular-devkit/core/src/utils/strings';
import { validate } from 'class-validator';
import { CreateExportTransactionDto } from 'src/dtos/create-export-transaction.dto';
import { ExportTransaction } from '../entities/export-transaction.entity';
import { SolidIntrospectService } from './solid-introspect.service';

@Injectable()
export class ExportTransactionService extends CRUDService<ExportTransaction> {
  private logger = new Logger(ExportTransactionService.name);
  async triggerExport(exportTransactionId: number) {
    // Load the export transaction entry
    const exportTransaction = await this.repo.findOne({
        where: { id: exportTransactionId },
        relations: { exportTemplate: { modelMetadata: true } },
      }
    );

    // This method will fetch all the columns from the export template & write them to a file
    // Get the columns which need to be exported & the model id
    // const modelId = exportTransaction.exportTemplate.modelMetadata;
    const fields = exportTransaction.exportTemplate.fields;

    // Get the appropriate service for the model by trying to fetch a model service matching a particular name
    const modelName = exportTransaction.exportTemplate.modelMetadata.singularName;
    const modelService = this.introspectService.getProvider(`${classify(modelName)}Service`);


    // Call the appropriate service method to fetch the data
    // this.logger.log(`Fetching data for model ${modelName}`);
    // @ts-ignore
    const data = await modelService.instance.find({});
    this.logger.log(`Fetched ${data.length} records for model ${modelName}`);

    // This file will managed using the file storage provider
    // return data;
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
    @InjectRepository(ExportTransaction, 'default')
    readonly repo: Repository<ExportTransaction>,
    readonly introspectService: SolidIntrospectService,

  ) {
    super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'exportTransaction', 'solid-core');
  }

  async toDto(data: Partial<CreateExportTransactionDto>): Promise<CreateExportTransactionDto> {
    const dto = new CreateExportTransactionDto(data);
    const errors = await validate(dto);
    if (errors.length > 0) {
      console.error("Validation failed:", errors);
      return null;
    }
    return dto;
  }
}
