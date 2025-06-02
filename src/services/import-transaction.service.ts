import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { classify } from '@angular-devkit/core/src/utils/strings';
import { HttpService } from '@nestjs/axios';
import { RelationFieldsCommand, RelationType, SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { ImportInstructionsResponseDto, StandardImportInstructionsResponseDto } from 'src/dtos/import-instructions.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { MediaWithFullUrl } from 'src/interfaces';
import { Readable } from 'stream';
import { ImportTransaction } from '../entities/import-transaction.entity';
import { CsvService } from './csv.service';
import { ExcelService } from './excel.service';
import { SolidIntrospectService } from './solid-introspect.service';

interface ImportTemplateFileInfo {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
}

export enum ImportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
}
export interface ImportMappingInfo {
  sampleImportedRecordInfo: SampleImportedRecordInfo[];
  importableFields: ImportableFieldInfo[];
}
export interface SampleImportedRecordInfo {
  cellHeader: string; // The header of the cell in the import file
  cellValue: string; // The value of the cell in the import file
  defaultMappedFieldName: string; // The default mapped field name in the model metadata
}
export interface ImportableFieldInfo {
  name: string;
  displayName: string;
}

export interface ImportPaginatedReadResult {
  headers: string[]; // Headers of the CSV file
  data: Record<string, any>[]; // Data records in the current page
}

interface ImportMapping {
  header: string; // The name of the field in the import file
  fieldName: string; // The name of the field in the model metadata to which the imported field is mapped
}

@Injectable()
export class ImportTransactionService extends CRUDService<ImportTransaction> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ImportTransaction, 'default')
    readonly repo: Repository<ImportTransaction>,
    readonly moduleRef: ModuleRef,
    readonly excelService: ExcelService,
    readonly csvService: CsvService,
    readonly httpService: HttpService,
    readonly introspectService: SolidIntrospectService,
    // readonly fieldMetadataService: FieldMetadataService,
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'importTransaction', 'solid-core', moduleRef);
  }

  private readonly logger = new Logger(ImportTransactionService.name);

  /**
 * This method is used to return a csv / excel template for the import transaction
 * It will contain the display names of the fields in the header row
 * @param modelMetadataId 
 */
  async getImportTemplate(modelMetadataId: number, format: ImportFormat = ImportFormat.CSV): Promise<ImportTemplateFileInfo> {
    // Load the model metadata for the given ID
    const modelMetadata = await this.modelMetadataService.findOne(modelMetadataId, {
      populate: ['fields'],
    });
    if (!modelMetadata) {
      throw new Error(`Model metadata with ID ${modelMetadataId} not found.`);
    }
    // Create a header row with the display names of the fields, excluding the media fields,computed fields
    const headers = this.fieldsAllowedForImport(modelMetadata.fields)
      .map(field => field.displayName);

    // Depending on the format, generate the template
    if (format === ImportFormat.CSV) {
      const stream = await this.csvService.createCsvStream(null, 0, headers); // Create a CSV stream with the header row
      const fileName = `${modelMetadata.singularName}-import-template.csv`;
      const mimeType = 'text/csv';
      return {
        stream,
        fileName,
        mimeType,
      };
    } else if (format === ImportFormat.EXCEL) {
      const stream = await this.excelService.createExcelStream(null, 0, headers); // Create an Excel stream with the header row
      const fileName = `${modelMetadata.singularName}-import-template.xlsx`;
      // Set the MIME type for Excel files
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      return {
        stream,
        fileName,
        mimeType,
      };
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

  }

  async getImportInstructions(modelMetadataId: number): Promise<ImportInstructionsResponseDto> {
    // Load the model metadata for the given ID
    const modelMetadata = await this.modelMetadataService.findOne(modelMetadataId, {
      populate: ['fields'],
    });
    if (!modelMetadata) {
      throw new Error(`Model metadata with ID ${modelMetadataId} not found.`);
    }

    // Create the standard import instructions
    const standardInstructions: StandardImportInstructionsResponseDto = {
      requiredFields: [],
      dateFields: [],
      dateTimeFields: [],
      numberFields: [],
      emailFields: [],
      regexFields: [],
      jsonFields: [],
      booleanFields: [],
    };

    // Iterate through the fields and populate the standard instructions
    for (const field of modelMetadata.fields) {
      if (field.isSystem) continue; // Skip system fields
      if (field.required) {
        standardInstructions.requiredFields.push(field.displayName);
      }
      if (field.type === SolidFieldType.date) {
        standardInstructions.dateFields.push(field.displayName);
      }
      if (field.type === SolidFieldType.datetime) {
        standardInstructions.dateTimeFields.push(field.displayName);
      }
      if ([SolidFieldType.bigint, SolidFieldType.int, SolidFieldType.decimal].includes(field.type as SolidFieldType)) {
        standardInstructions.numberFields.push(field.displayName);
      }
      if (field.type === SolidFieldType.email) {
        standardInstructions.emailFields.push(field.displayName);
      }
      if (field.regexPattern) {
        standardInstructions.regexFields.push({
          fieldName: field.displayName,
          regexPattern: field.regexPattern,
        });
      }
      if (field.type === SolidFieldType.json) {
        standardInstructions.jsonFields.push(field.displayName);
      }
      if (field.type === SolidFieldType.boolean) {
        standardInstructions.booleanFields.push(field.displayName);
      }
    }

    // Create the custom instructions
    const customInstructions: string[] = [];

    return {
      standard: standardInstructions,
      custom: customInstructions,
    };
  }

  async getImportMappingInfo(importTransactionId: number): Promise<ImportMappingInfo> {
    // Load the import transaction for the given ID
    const importTransaction = await this.loadImportTransaction(importTransactionId);

    // Get all the importable fields from the model metadata
    const importableFields: ImportableFieldInfo[] = this.fieldsAllowedForImport(importTransaction.modelMetadata.fields).map(field => ({
      name: field.name,
      displayName: field.displayName,
    }));

    // Get the import file media object from the import transaction
    const importFileMediaObject = this.getImportFileObject(importTransaction);

    // Get the import file stream for the import transaction
    const importFileStream = await this.getImportFileStream(importFileMediaObject);

    // Get a sample of records from the import file
    const sampleRecord = await this.getFileRecordsSample(importFileStream, importFileMediaObject.mimeType);

    // Convert sampleRecord to the format required for SampleImportedRecordInfo
    const wrappedRecords: SampleImportedRecordInfo[] = sampleRecord.data.map((record: Record<string, any>) => {
      return Object.entries(record).map(([key, value]) => ({
        cellHeader: key,
        cellValue: value,
        defaultMappedFieldName: importableFields.find(field => field.displayName === key)?.name || '',
      }));
    }).flat();

    //     for await (const page of this.csvService.readCsvInPagesFromStream(importFileStream)) {
    //   // await dbService.bulkInsert(page);
    // }

    return {
      sampleImportedRecordInfo: wrappedRecords, // This will hold the sample data from the file
      importableFields: importableFields, // This will hold the fields that can be imported
    };
  }

  async startImportSync(importTransactionId: number): Promise<Array<number>> {
    // Load the import transaction for the given ID
    const importTransaction = await this.loadImportTransaction(importTransactionId);

    // Get the import file media object from the import transaction
    const importFileMediaObject = this.getImportFileObject(importTransaction);

    // Get the import file stream for the import transaction
    const importFileStream = await this.getImportFileStream(importFileMediaObject);

    const ids = await this.writeFileRecordsToDb(
      importFileStream,
      importFileMediaObject.mimeType,
      JSON.parse(importTransaction.mapping) as ImportMapping[], // Parse the mapping from the import transaction
      importTransaction.modelMetadata,
    );
    return ids; // Return the IDs of the created records
  }

  startImportAsync(importTransactionId: number): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async loadImportTransaction(importTransactionId: number) {
    const importTransaction = await this.findOne(importTransactionId, {
      populate: ['modelMetadata', 'modelMetadata.fields'],
      populateMedia: ['fileLocation'],
    });
    if (!importTransaction) {
      throw new Error(`Import transaction with ID ${importTransactionId} not found.`);
    }
    return importTransaction;
  }

  private fieldsAllowedForImport(fields: FieldMetadata[]): FieldMetadata[] {
    // Filter out fields that are not allowed for import
    return fields.filter(field =>
      field.type !== SolidFieldType.mediaMultiple && // Exclude media multiple fields
      field.type !== SolidFieldType.mediaSingle &&
      field.type !== SolidFieldType.computed && // Exclude computed fields
      field.type !== SolidFieldType.password &&
      field.type !== SolidFieldType.richText &&
      field.type !== SolidFieldType.uuid &&
      field.isSystem !== true // Exclude system fields
    );
  }

  private async getFileRecordsSample(importFileStream: Readable, mimeType: string): Promise<ImportPaginatedReadResult> {
    // Depending upon the mime type of the file, read the file in pages
    // For CSV files, use the csvService to read the file in pages
    // For Excel files, use the excelService to read the file in pages
    if (mimeType === 'text/csv') {
      const generator = this.csvService.readCsvInPagesFromStream(importFileStream, { pageSize: 1 });
      const firstRecord = await generator.next(); // Get the first record to extract headers and sample data
      return firstRecord.value;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const generator = this.excelService.readExcelInPagesFromStream(importFileStream, { pageSize: 1 });
      const firstRecord = await generator.next(); // Get the first record to extract headers and sample data
      return firstRecord.value;
    }
    else { // If the file is neither CSV nor Excel, throw an error
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  private getImportFileObject(importTransaction: ImportTransaction): MediaWithFullUrl {
    const importFileMediaObject = importTransaction['_media']['fileLocation'][0] as MediaWithFullUrl; // Since there can be only one fileLocation, we can safely access the first element
    if (!importFileMediaObject) {
      throw new Error(`Import file for transaction ID ${importTransaction.id} not found.`);
    }
    return importFileMediaObject;
  }

  private async getImportFileStream(importFileMediaObject: MediaWithFullUrl): Promise<Readable> {
    const fileUrl = importFileMediaObject['_full_url'];
    const mimeType = importFileMediaObject['mimeType'];
    if (!fileUrl) {
      throw new Error(`File URL  ${fileUrl} not found.`);
    }
    // From the file URL, convert the file URL to a readable stream using nestjs http service and axios
    const fileUrlResponse = await this.httpService.axiosRef.get(fileUrl, {
      responseType: 'stream',
    });

    if (!fileUrlResponse || !fileUrlResponse.data) {
      throw new Error(`Failed to read file from URL: ${fileUrl}`);
    }
    // fileUrlResponse.data is a Node.js Readable stream
    return fileUrlResponse.data;
  }

  private async writeFileRecordsToDb(
    importFileStream: Readable,
    mimeType: string,
    mapping: ImportMapping[],
    modelMetadataWithFields: ModelMetadata,
  ): Promise<Array<number>> {
    // Get the model service for the model metadata name
    const modelService = this.getModelService(modelMetadataWithFields.singularName);

    // Depending upon the mime type of the file, read the file in pages
    // For CSV files, use the csvService to read the file in pages
    // For Excel files, use the excelService to read the file in pages
    if (mimeType === 'text/csv') {
      // Read the csv file in pages
      for await (const page of this.csvService.readCsvInPagesFromStream(importFileStream)) {
        // Convert the paginated result to DTOs
        const dtos = await this.convertPaginatedResultToDtos(page, modelMetadataWithFields, mapping);
        // Use the model service to create the records in the database
        const createdRecords = await modelService.insertMany(dtos, [], {});
        // Set the solidRequestContext to null, as this is a background job;
        // Return the IDs of the created records
        return createdRecords.map(record => record.id);
      }
    }
    else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Read the excel file in pages
      for await (const page of this.excelService.readExcelInPagesFromStream(importFileStream)) {
        // Convert the paginated result to DTOs
        const dtos = await this.convertPaginatedResultToDtos(page, modelMetadataWithFields, mapping);
        // Use the model service to create the records in the database
        const createdRecords = await modelService.insertMany(dtos, [], {});
        // Set the solidRequestContext to null, as this is a background job;
        // Return the IDs of the created records
        return createdRecords.map(record => record.id);
      }
    } else { // If the file is neither CSV nor Excel, throw an error
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  private getModelService(modelSingularName: string): CRUDService<any> {
    // Get the model service for the model metadata name
    const modelServiceWrapper = this.introspectService.getProvider(`${classify(modelSingularName)}Service`);
    const modelService = modelServiceWrapper.instance as CRUDService<any>;
    if (!modelService) {
      throw new Error(`Model service for ${modelSingularName} not found.`);
    }
    return modelService;
  }

  // This method will 
  private async convertPaginatedResultToDtos(importPaginatedResult: ImportPaginatedReadResult, modelMetadataWithFields: ModelMetadata, mapping: ImportMapping[]){
    const dtos = [];
    // Iterate through the data records in the importPaginatedResult
    for (const record of importPaginatedResult.data) {
      // For every key in the record, get the corresponding field from the mapping, if the field is not found in mapping, skip the field
      const dto = await this.convertImportedRecordToDto(record, mapping, modelMetadataWithFields);
      dtos.push(dto);
    }
    return dtos;
  }

  private async convertImportedRecordToDto(record: Record<string, any>, mapping: ImportMapping[], modelMetadataWithFields: ModelMetadata) {
    // Create a new record object
    const dtoRecord: Record<string, any> = {};

    // Using the saved mapping, populate the dtoRecord w.r.t the record and fields
    for (const key in record) {
      const mappedField = mapping.find(m => m.header === key);
      if (mappedField) {
        // If the field is found in the mapping, get the field metadata from the model metadata
        const fieldMetadata = modelMetadataWithFields.fields.find(f => f.name === mappedField.fieldName);
        // const userKeyField = modelMetadataWithFields.fields.find(f => f.isUserKey === true); // Assuming userKey is a field in the model metadata
        if (fieldMetadata) {
          // If the field is found in the model metadata, set the value in the dtoRecord
          await this.populateDto(dtoRecord, fieldMetadata, record, key);
        } else {
          this.logger.warn(`Field ${mappedField.fieldName} not found in model metadata ${modelMetadataWithFields.singularName}`);
        }
      }
    }
    return dtoRecord;
  }

  private async populateDto(dtoRecord: Record<string, any>, fieldMetadata: FieldMetadata, record: Record<string, any>, key: string): Promise<Record<string, any>> {
    const fieldType = fieldMetadata.type;
    // const userKeyFieldName = userKeyField?.name || 'id'; // Default to 'id' if not found

    switch (fieldType) {
      case SolidFieldType.relation: {
        // Get the coModelService for the related model
        if (!fieldMetadata.relationCoModelSingularName) {
          throw new Error(`Relation coModelSingularName is not defined for relation field ${fieldMetadata.name}`);
        }
        const coModelService = this.getModelService(fieldMetadata.relationCoModelSingularName);
        const userKeyFilterDto = {
          filters: {
            modelMetadata: {
              singularName: {
                $eq: fieldMetadata.relationCoModelSingularName, // Filter by the related model's singular name
              }
            },
            isUserKey: true, // Assuming the userKey field is marked as isUserKey in the model metadata
          },  
        }
        // const coModelUserKeyFieldResult = await this.fieldMetadataService.findMany(userKeyFilterDto)
        // if (!coModelUserKeyFieldResult || !coModelUserKeyFieldResult.records || coModelUserKeyFieldResult.records.length === 0 ) {
        //   throw new Error(`Missing userKey in model ${fieldMetadata.relationCoModelSingularName}`);
        // }
        // const userKeyField = coModelUserKeyFieldResult.records.map(record => record[userKeyFieldName]).pop(); // Get the userKey field from the related model metadata
        // const userKeyFieldName = userKeyField?.name || 'id'; // Assuming the userKey field is the first field in the related model metadata 
        const userKeyFieldName = 'id';

        // For many-to-many or one-to-many relations, we expect the record cell to contains a comma-separated list of userKeys
        const relationUserKeys = record[key] ? String(record[key]).split(',').map((userKey: string) => userKey.trim()) : [];

        // Set the relation basic filter dto filters with the userkeys and call the find method of the model service to get the related records
        const relationFilterDto = {
          filters: {
            [userKeyFieldName]: {
              $in: relationUserKeys, // Use the userKeyFieldName to filter by userKeys
            },
          },
        }

        // From the userKeys, we will get the IDs of the related records using the userKeyFieldName and throw an error if any of the userKeys is not found
        const relatedRecordsResult = await coModelService.find(relationFilterDto);
        if (!relatedRecordsResult || !relatedRecordsResult.records || relatedRecordsResult.records.length === 0 || relatedRecordsResult.records.length !== relationUserKeys.length) {
          throw new Error(`Missing related records found for userKeys: ${relationUserKeys.join(', ')} in model ${fieldMetadata.relationCoModelSingularName}`);
        }
        const relatedRecordsIds = relatedRecordsResult.records.map(record => record[userKeyFieldName]);
        if (fieldMetadata.relationType === RelationType.manyTomany || fieldMetadata.relationType === RelationType.oneToMany) {
          // We will then set the dtoRecord ids, commmand e.g authorsIds: number[];authorsCommand: string;
          dtoRecord[`${fieldMetadata.name}Ids`] = relatedRecordsIds;
          dtoRecord[`${fieldMetadata.name}Command`] = RelationFieldsCommand.set; // Assuming we want to add the related records
        }
        else if (fieldMetadata.relationType === RelationType.manyToOne) {
          // We will then set the dtoRecord id
          dtoRecord[`${fieldMetadata.name}Id`] = relatedRecordsIds.pop(); // For many-to-one relation, we expect only one related record, so we can safely pop the last element
        }
        return dtoRecord;
      }
      default:
        dtoRecord[fieldMetadata.name] = record[key];
        return dtoRecord;
    }
  }


}
