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


import { classify, dasherize } from '@angular-devkit/core/src/utils/strings';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { validate } from 'class-validator';
import { BasicFilterDto } from 'src/dtos/basic-filters.dto';
import { CreateExportTransactionDto } from 'src/dtos/create-export-transaction.dto';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { ExportTransaction } from '../entities/export-transaction.entity';
import { ExcelService } from './excel.service';
import { getMediaStorageProvider } from './mediaStorageProviders';
import { SolidIntrospectService } from './solid-introspect.service';
import { Readable } from 'stream';

const EXPORT_CHUNK_SIZE = 100;
@Injectable()
export class ExportTransactionService extends CRUDService<ExportTransaction> {
  private logger = new Logger(ExportTransactionService.name);
  async triggerExport(id: number) {
    
    // Load the export transaction entry
    const exportTransaction = await this.repo.findOne({
      where: { id: id },
      relations: { exportTemplate: { modelMetadata: true } },
    }
    );

    // Get the columns which need to be exported & the model id
    const fields = JSON.parse(exportTransaction.exportTemplate.fields);

    // Get the appropriate service for the model by trying to fetch a model service matching a particular name
    const modelName = exportTransaction.exportTemplate.modelMetadata.singularName;
    const modelService = this.introspectService.getProvider(`${classify(modelName)}Service`);
    const templateName = exportTransaction.exportTemplate.templateName;
    const uuid = exportTransaction.exportTransactionId; //TODO can be renamed to exportTransactionUUID

    // Get the data records function
    const dataRecordsFunc = await this.getDataRecordsFunc(fields, modelService);

    // Get the export passthru stream (since it is a passthru stream, nothing is stored in memory & it is streamed directly when the stream is read)
    const exportStream = await this.excelService.createExcelStream(dataRecordsFunc, EXPORT_CHUNK_SIZE)

    // Store the file using the appropriate storage provider
    await this.storeExportStream(exportStream, templateName, uuid, exportTransaction);
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
    readonly excelService: ExcelService,
    // readonly fieldMetadataService: FieldMetadataService,
    @InjectRepository(FieldMetadata, 'default')
    readonly fieldRepo: Repository<FieldMetadata>,
  ) {
    super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'exportTransaction', 'solid-core');
  }


  private async storeExportStream(exportStream: Readable, templateName: string, uuid: string, exportTransaction: ExportTransaction) {
    const exportedFileMediaField = await this.fieldRepo.findOne({
      where: {
        name: 'exportedFile',
        model: {
          singularName: 'exportTransaction'
        },
      },
      relations: ['model', 'mediaStorageProvider'],
    });
    // const storageProvider = new FileStorageProvider<ExportTransaction>(this.configService, this.fileService, this.mediaService);
    const storageProviderMetadata = exportedFileMediaField.mediaStorageProvider;

    // // Use the storage provider metadata to get the appropriate storage provider implementation
    const storageProviderType = storageProviderMetadata.type as MediaStorageProviderType;

    // // Get the storage provider implementation
    const storageProvider = getMediaStorageProvider(this.configService, this.fileService, this.mediaService, storageProviderType);

    //Commented the below code since we will be direclty images from server on call from ui 
    // await storageProvider.delete(savedEntity, mediaField);
    await storageProvider.storeStreams([[exportStream, `${dasherize(templateName)}-${uuid}.xlsx`]], exportTransaction, exportedFileMediaField);
  }

  private async getDataRecordsFunc(fields: any, modelService: InstanceWrapper<any>): Promise<(chunkIndex: number, chunkSize: number) => Promise<any[]>> {
    // Return a function which will take the chunkIndex & chunkSize and return the data
    return async (chunkIndex: number, chunkSize: number) => {
      const offset = chunkIndex * chunkSize;
      const recordFilterDto: BasicFilterDto = {
        fields,
        limit: chunkSize,
        offset,
      };
      const data = await modelService.instance.find(recordFilterDto);
      const records = data.records ?? [];
      return records;
    }
  }


  private async getDataCount(fields: any, modelProvider: InstanceWrapper<any>) {
    const countFilterDto: BasicFilterDto = {
      fields,
      limit: 1,
      offset: 0,
    };
    const countData = await modelProvider.instance.find(countFilterDto);
    const totalCount = countData?.meta?.totalRecords ?? 0;
    return totalCount;
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
