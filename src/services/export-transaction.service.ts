import { Injectable, Logger } from '@nestjs/common';
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


import { classify, dasherize } from '@angular-devkit/core/src/utils/strings';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { validate } from 'class-validator';
import { BasicFilterDto } from 'src/dtos/basic-filters.dto';
import { CreateExportTransactionDto } from 'src/dtos/create-export-transaction.dto';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { Readable } from 'stream';
import { ExportTransaction } from '../entities/export-transaction.entity';
import { CsvService } from './csv.service';
import { ExcelService } from './excel.service';
import { getMediaStorageProvider } from './mediaStorageProviders';
import { SolidIntrospectService } from './solid-introspect.service';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { UpdateExportTemplateDto } from 'src/dtos/update-export-template.dto';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';

const EXPORT_CHUNK_SIZE = 100;
enum ExportStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
}

export interface ExportTransactionFileInfo {
  exportStream: Readable;
  fileName: string;
  mimeType: string;
  exportTransaction: ExportTransaction;
}

@Injectable()
export class ExportTransactionService extends CRUDService<ExportTransaction> {
  private logger = new Logger(ExportTransactionService.name);

  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ExportTransaction, 'default')
    readonly repo: Repository<ExportTransaction>,
    readonly introspectService: SolidIntrospectService,
    readonly excelService: ExcelService,
    readonly csvService: CsvService,
    // readonly fieldMetadataService: FieldMetadataService,
    @InjectRepository(FieldMetadata, 'default')
    readonly fieldRepo: Repository<FieldMetadata>,
    @InjectRepository(ModelMetadata, 'default')
    readonly ModelMetadataRepo: Repository<ModelMetadata>,
    readonly moduleRef: ModuleRef,
    private readonly modelMetadataHelperService: ModelMetadataHelperService,

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'exportTransaction', 'solid-core',moduleRef);
  }

  // Return the export stream
  async triggerExportSync(id: number, exportTransactionEntity: any, updateDto: UpdateExportTemplateDto , filters: any): Promise<ExportTransactionFileInfo> {
    try {
      // const loadedExportTransaction = await this.loadExportTransaction(id);
      // from updateDto, get modelId and get modelMetadata
      const modeldata = await this.ModelMetadataRepo.findOne({
        where: { id:  updateDto?.modelMetadataId},
        relations: { fields: true},
      })
      const modelName = modeldata?.singularName;
      const modelTemplateName = modelName;
      const fields = JSON.parse(updateDto?.fields);
      const templateFormat = updateDto?.templateFormat;
      const { exportStream, templateName, uuid, exportTransaction } = await this.getExportStreamDetails(modelName, modelTemplateName, fields, modeldata, templateFormat, id, exportTransactionEntity, filters);
      this.updateExportTransaction(id, ExportStatus.COMPLETED);
      const fileName = this.getFileName(templateName, uuid, templateFormat);
      const mimeType = this.getMimeType(templateFormat);
      return { exportStream, fileName, mimeType, exportTransaction };
    } catch (error) {
      this.updateExportTransaction(id, ExportStatus.FAILED, error.message);
      throw error;
    }
  }

  // Store the export stream using the appropriate storage provider
  async triggerExportAsync(id: number, exportTransactionEntity: any, updateDto: UpdateExportTemplateDto, filters:any): Promise<void> {
    try {
      // const loadedExportTransaction = await this.loadExportTransaction(id)
      // from updateDto, get modelId and get modelMetadata
      const modeldata = await this.ModelMetadataRepo.findOne({
        where: { id:  updateDto?.modelMetadataId},
        relations: { fields: true},
      })
      const modelName = modeldata?.singularName;
      const modelTemplateName = modelName;
      const fields = JSON.parse(updateDto?.fields);
      const templateFormat = updateDto?.templateFormat;
      const { exportStream, templateName, uuid, exportTransaction } = await this.getExportStreamDetails(modelName, modelTemplateName, fields, modeldata, templateFormat, id, exportTransactionEntity, filters);
      // const fileFormat = loadedExportTransaction.exportTemplate.templateFormat;
      // Store the file using the appropriate storage provider
      await this.storeExportStream(exportStream, exportTransaction, this.getFileName(templateName, uuid, templateFormat));
      this.updateExportTransaction(id, ExportStatus.COMPLETED);
    } catch (error) {
      this.updateExportTransaction(id, ExportStatus.FAILED, error.message);
      throw error;

    }
  }

  private async loadExportTransaction(id: number) {
    return await this.repo.findOne({
      where: { id: id },
      relations: { exportTemplate: { modelMetadata: {fields: true} }},
    }
    );
  }

  private async updateExportTransaction(id: number, status: string, error?: string) {
    await this.repo.update(id, { status, error });
  }

  private async getExportStreamDetails(modelName: string, templateName: string, fields:any, modelData:any, templateFormat:string, id:number, exportTransaction: any, filters: any) {
    // Get the columns which need to be exported & the model id
    // const fields = JSON.parse(exportTransaction.exportTemplate.fields);

    // // Get the appropriate service for the model by trying to fetch a model service matching a particular name
    // const modelName = exportTransaction.exportTemplate.modelMetadata.singularName;
     const modelService = this.introspectService.getProvider(`${classify(modelName)}Service`);
    // const templateName = exportTransaction.exportTemplate.templateName;
     const uuid = String(id); //TODO can be renamed to exportTransactionUUID
    // const modelData = exportTransaction.exportTemplate.modelMetadata;

    // Get the data records function
    //const dataRecordsFunc = await this.getDataRecordsFunc(fields, modelService,modelData, filters);
    const dataRecordsFunc = await this.getDataRecordsFunc(fields, modelService, modelData, filters);

    // Get the export passthru stream (since it is a passthru stream, nothing is stored in memory & it is streamed directly when the stream is read)
    // let exportStream = await this.getExportStream(exportTransaction.exportTemplate.templateFormat, dataRecordsFunc);
    // return { exportStream, templateName, uuid, exportTransaction };

    let exportStream = await this.getExportStream(templateFormat, dataRecordsFunc);
    return { exportStream, templateName, uuid, exportTransaction };
  }

  private async getExportStream(templateFormat: string, dataRecordsFunc: (chunkIndex: number, chunkSize: number) => Promise<any[]>) {
    let exportStream = null;
    switch (templateFormat) {
      case ExportFormat.EXCEL:
        exportStream = await this.excelService.createExcelStream(dataRecordsFunc, EXPORT_CHUNK_SIZE);
        break;
      case ExportFormat.CSV:
        exportStream = await this.csvService.createCsvStream(dataRecordsFunc, EXPORT_CHUNK_SIZE);
        break;
      default:
        throw new Error(ERROR_MESSAGES.INVALID_FORMAT('export' + templateFormat));
    }
    return exportStream;
  }

  private async storeExportStream(exportStream: Readable, exportTransaction: ExportTransaction, fileName: string) {
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
    const storageProvider = await getMediaStorageProvider(this.moduleRef, storageProviderType);

    //Commented the below code since we will be direclty images from server on call from ui 
    await storageProvider.storeStreams([[exportStream, fileName]], exportTransaction, exportedFileMediaField)
  }

  private getFileName(templateName: string, exportTransactionUUID: string, fileFormat: string): string {
    const extension = (fileFormat === ExportFormat.EXCEL) ? 'xlsx' : 'csv';
    return `${dasherize(templateName)}-${exportTransactionUUID}.${extension}`;
  }

  private getMimeType(fileFormat: string): string {
    return (fileFormat === ExportFormat.EXCEL) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
  }

  private async getDataRecordsFunc(fields: any, modelService: InstanceWrapper<any>, modelMetadata: any, filters:any): Promise<(chunkIndex: number, chunkSize: number) => Promise<any[]>> {
    //Load all possible fields for the model
    const allModelFields = await this.modelMetadataHelperService.loadFieldHierarchy(
      modelMetadata.singularName,
    );

    // Filter only the fields requested in the export payload
    const modelFields = allModelFields.filter((f: any) =>
      fields.includes(f.name),
    );

    //Get the model metadata of relation field with userKey details
    const relatedModelsUserKeyMap = new Map<string, string>();
    for (const field of modelFields) {
      if (field.relationType && field.relationCoModelSingularName) {
        const relatedModelMetadata = await this.ModelMetadataRepo.findOne({
          where: { singularName: field.relationCoModelSingularName },
          relations: ['userKeyField'],
        });

        if (relatedModelMetadata?.userKeyField?.name) {
          relatedModelsUserKeyMap.set(field.name, relatedModelMetadata.userKeyField.name);
        }
      }
    }

    return async (chunkIndex: number, chunkSize: number) => {
      const offset = chunkIndex * chunkSize;
      const recordFilterDto: BasicFilterDto = {
        limit: chunkSize,
        offset,
        //only contains relational fields (so TypeORM includes relations in the result).
        populate: modelFields
          .filter((f: any) => f.relationType !== null)
          .map((f: any) => f.name),
      };
      const cleanedFilters = cleanNullsFromObject(filters);

      if (cleanedFilters && Object.keys(cleanedFilters).length > 0) {
        recordFilterDto.filters = cleanedFilters;
      }

      const data = await modelService.instance.find(recordFilterDto);
      const records = data.records ?? [];
    const cleanedRecords = records.map((record: Record<string, any>) => {
      const newRecord: Record<string, any> = {};
    
      // Include non-relational fields
      for (const field of modelFields) {
          if (!field.relationType) {
            newRecord[field.name] = record[field.name];
          }
        }
    
      // Include userKey from each related field
      for (const [relatedFieldName, userKeyFieldName] of relatedModelsUserKeyMap.entries()) {
        const relatedData = record[relatedFieldName];
    
        if (Array.isArray(relatedData)) {
          // For many-to-many or one-to-many
          const values = relatedData.map(item => item?.[userKeyFieldName]).filter(Boolean);
          newRecord[relatedFieldName] = values.join(', ');
        } else if (relatedData && typeof relatedData === 'object') {
          // For many-to-one or one-to-one
          newRecord[relatedFieldName] = relatedData?.[userKeyFieldName] ?? null;
        } else {
          newRecord[relatedFieldName] = null;
        }
      }
    
      return newRecord;
    });
    return cleanedRecords
  }
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

function cleanNullsFromObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== null && item !== undefined)
      .map(cleanNullsFromObject);
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        const cleanedValue = cleanNullsFromObject(value);
        // Only assign non-empty objects/arrays or non-null primitives
        if (
          (typeof cleanedValue === 'object' && Object.keys(cleanedValue).length > 0) ||
          (Array.isArray(cleanedValue) && cleanedValue.length > 0) ||
          typeof cleanedValue !== 'object'
        ) {
          newObj[key] = cleanedValue;
        }
      }
    }
    return newObj;
  }
  return obj;
}

