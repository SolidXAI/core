import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { ImportTransactionErrorLog } from 'src/entities/import-transaction-error-log.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { MediaWithFullUrl } from 'src/interfaces';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
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

export enum ImportMimeTypes {
  CSV = 'text/csv',
  EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

export interface ImportSyncResult {
  status: string; // The status of the import transaction
  importedIds: Array<number>; // The IDs of the records created during the import
}

interface ImportRecordsResult {
  ids: Array<number>; // The IDs of the records created during the import
  errorLogIds: Array<number>; // The IDs of the error log entries created during the import
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
      required: field.required,
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

  async startImportSync(importTransactionId: number): Promise<ImportSyncResult> {
    // Load the import transaction for the given ID
    const importTransaction = await this.loadImportTransaction(importTransactionId);

    // Get the import file media object from the import transaction
    const importFileMediaObject = this.getImportFileObject(importTransaction);

    // Get the import file stream for the import transaction
    const importFileStream = await this.getImportFileStream(importFileMediaObject);

    const { ids, errorLogIds } = await this.importFromFileToDB(
      importTransaction,
      importFileStream,
      importFileMediaObject.mimeType,
    );

    // Update the import transaction status to 'completed'
    (errorLogIds.length > 0) ? importTransaction.status = 'import_failed' : importTransaction.status = 'import_succeeded'; //FIXME: We can probably have import_partially_failed status to differentiate
    // Save the import transaction
    await this.repo.save(importTransaction);

    return { status: importTransaction.status, importedIds: ids }; // Return the IDs of the created records
  }

  startImportAsync(importTransactionId: number): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async exportFailedImportedImports(importTransactionId: number) {
    // Get the 1st error log entry to determine the headers for the export file
    const firstErrorLogEntry = await this.entityManager.getRepository(ImportTransactionErrorLog).findOne({
      where: {
        importTransaction: { id: importTransactionId },
      },
    });

    if (!firstErrorLogEntry) {
      throw new BadRequestException(`No error log entries found for import transaction ID ${importTransactionId}.`);
    }

    // Create the headers for the export file
    const headers = [
      ...Object.keys(firstErrorLogEntry.rowData ? JSON.parse(firstErrorLogEntry.rowData) : {}), // Include all keys from the rowData JSON
      'Error', // Error message for the failed record
    ];


    // Depending upon the format of the import tranaction file, create a readable stream of the error log entries
    const importTransaction = await this.loadImportTransaction(importTransactionId);
    const importFileMediaObject = this.getImportFileObject(importTransaction);
    const mimeType = importFileMediaObject.mimeType;
    const templateFormat = mimeType === ImportMimeTypes.CSV ? "csv" : "excel";
    const dataRecordsFunc = async (chunkIndex: number, chunkSize: number): Promise<any[]> => {
      // Get the error log entries for the import transaction
      const errorLogEntries = await this.entityManager.getRepository(ImportTransactionErrorLog).find({
        where: {
          importTransaction: { id: importTransactionId },
        },
        skip: chunkIndex * chunkSize,
        take: chunkSize,
      });

      if (!errorLogEntries || errorLogEntries.length === 0) {
        return []; // Return an empty array if no error log entries found
      }

      // Read the row data json from the error log entry, parse it and write it as a record to the stream
      return errorLogEntries.map(entry => {
        const rowData = entry.rowData ? JSON.parse(entry.rowData) : {};
        return {
          ...rowData, // Spread the row data into the record
          Error: entry.errorMessage,
        };
      });
    };

    // Get the export stream for the failed records
    const exportStream = await this.getFailedRecordsStream(templateFormat, headers, dataRecordsFunc);
    if (!exportStream) {
      throw new BadRequestException(`Failed to create export stream for import transaction ID ${importTransactionId}.`);
    }
    // Return the export stream
    return {
      stream: exportStream,
      fileName: `${importTransaction.modelMetadata.singularName}-failed-imports.${templateFormat}`,
      mimeType: templateFormat === "excel" ? ImportMimeTypes.EXCEL : ImportMimeTypes.CSV,
    };

  }

  private async getFailedRecordsStream(templateFormat: string, headers: string[], dataRecordsFunc: (chunkIndex: number, chunkSize: number) => Promise<any[]>) {
    let exportStream = null;
    switch (templateFormat) {
      case "excel":
        exportStream = await this.excelService.createExcelStream(dataRecordsFunc, 100, headers);
        break;
      case "csv":
        exportStream = await this.csvService.createCsvStream(dataRecordsFunc, 100, headers);
        break;
      default:
        throw new Error('Invalid export format');
    }
    return exportStream;
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

  private async importFromFileToDB(
    importTransaction: ImportTransaction,
    importFileStream: Readable,
    mimeType: string,
  ): Promise<ImportRecordsResult> {
    if (!importTransaction.modelMetadata) {
      throw new Error(`Model metadata for import transaction ID ${importTransaction.id} not found.`);
    }

    const createdRecordIds = [];
    const createdErrorLogIds = [];

    // Get the model service for the model metadata name
    const modelService = this.getModelService(importTransaction.modelMetadata.singularName);

    // Depending upon the mime type of the file, read the file in pages and insert the records into the database
    if (mimeType === ImportMimeTypes.CSV) {
      for await (const page of this.csvService.readCsvInPagesFromStream(importFileStream)) {
        const { ids, errorLogIds } = await this.importRecords(page, importTransaction, modelService);
        createdRecordIds.push(...ids);
        createdErrorLogIds.push(...errorLogIds);
      }
    }
    else if (mimeType === ImportMimeTypes.EXCEL) {
      for await (const page of this.excelService.readExcelInPagesFromStream(importFileStream)) {
        const { ids, errorLogIds } = await this.importRecords(page, importTransaction, modelService);
        createdRecordIds.push(...ids);
        createdErrorLogIds.push(...errorLogIds);
      }
    } else { // If the file is neither CSV nor Excel, throw an error
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    return {
      ids: createdRecordIds, // Return the IDs of the created records
      errorLogIds: createdErrorLogIds, // Return the IDs of the error log entries created during the import
    }
  }

  private async importRecords(page: ImportPaginatedReadResult, importTransaction: ImportTransaction, modelService: CRUDService<any>): Promise<ImportRecordsResult> {
    if (!importTransaction.modelMetadata || !importTransaction.modelMetadata.fields) {
      throw new Error(`Model metadata with fields for import transaction ID ${importTransaction.id} not found.`);
    }

    const ids: Array<number> = [];
    const errorLogIds: Array<number> = [];
    for (const record of page.data) {
      try {
        const createdRecord = await this.insertRecord(record, JSON.parse(importTransaction.mapping) as ImportMapping[], importTransaction.modelMetadata, modelService);
        ids.push(createdRecord.id); // Add the ID of the created record to the ids array
      }
      catch (error) {
        this.logger.debug(`Error inserting record: ${JSON.stringify(record)}. Error: ${error.message}`);
        // Get the Import transaction error log repo
        const errorLog = await this.createErrorLogEntry(importTransaction, record, error);
        errorLogIds.push(errorLog.id); // Add the ID of the error log entry to the errorLogIds array
      }
    }
    return {
      ids: ids, // Return the IDs of the created records
      errorLogIds: errorLogIds, // Return the IDs of the error log entries created during the import
    };
  }

  private async createErrorLogEntry(importTransaction: ImportTransaction, record: Record<string, any>, error: any) {
    const importTransactionRepo = this.entityManager.getRepository(ImportTransactionErrorLog);
    // Create a new ImportTransactionErrorLog entry
    const rowNumber = uuidv4(); // Generate a unique row number or use page.rowNumber if available 

    const errorLogEntry = {
      importTransactionErrorLogId: `${importTransaction.id}-${rowNumber}`, // FIXME pending to retrieve the row number from the page
      rowNumber: 1, // FIXME pending to retrieve the row number from the page
      rowData: JSON.stringify(record), // Store the row data
      importTransaction: importTransaction, // Link to the import transaction
      errorMessage: error.message, // Store the error message
      errorTrace: error.stack || '', // Store the error stack trace if available
    } as ImportTransactionErrorLog;

    // Save the error log entry to the database
    const savedEntry = await importTransactionRepo.save(errorLogEntry);
    return savedEntry; // Return the ID of the saved error log entry
  }

  //FIXME Currently below method fails if any field in the record is not valid or if the record is not valid. It does not collect the errors for all fields in a record
  private async insertRecord(record: Record<string, any>, mapping: ImportMapping[], modelMetadataWithFields: ModelMetadata, modelService: CRUDService<any>): Promise<any> {
    // Convert the imported record to a DTO
    const dto = await this.convertImportedRecordToDto(record, mapping, modelMetadataWithFields);
    // Use the model service to create the record in the database
    const createdRecord = await modelService.create(dto, [], {}); //FIXME: Need to handle this part alongwith the refactoring of the CRUDService for permissions
    return createdRecord; // Return the created record
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

  private async convertImportedRecordToDto(record: Record<string, any>, mapping: ImportMapping[], modelMetadataWithFields: ModelMetadata) {
    // Create a new record object
    const dtoRecord: Record<string, any> = {};

    // Iterate through every cell in the record
    // Using the saved mapping, populate the dtoRecord w.r.t the record and fields
    for (const key in record) {
      const mappedField = mapping.find(m => m.header === key);
      if (mappedField) {
        // If the field is found in the mapping, get the field metadata from the model metadata
        const fieldMetadata = modelMetadataWithFields.fields.find(f => f.name === mappedField.fieldName);
        // const userKeyField = modelMetadataWithFields.fields.find(f => f.isUserKey === true); // Assuming userKey is a field in the model metadata
        if (fieldMetadata) {
          // If the field is found in the model metadata, set the value in the dtoRecord
          await this.populateDtoForACell(dtoRecord, fieldMetadata, record, key);
        } else {
          this.logger.warn(`Field ${mappedField.fieldName} not found in model metadata ${modelMetadataWithFields.singularName}`);
        }
      }
    }
    return dtoRecord;
  }

  private async populateDtoForACell(dtoRecord: Record<string, any>, fieldMetadata: FieldMetadata, record: Record<string, any>, key: string): Promise<Record<string, any>> {
    const fieldType = fieldMetadata.type;
    // const userKeyFieldName = userKeyField?.name || 'id'; // Default to 'id' if not found

    // TODO Move this logic to field crud managers i.e add a parse method to the field crud manager interface
    switch (fieldType) {
      case SolidFieldType.relation: {
        return await this.populateDtoForRelations(fieldMetadata, record, key, dtoRecord);
      }
      case SolidFieldType.date:
      case SolidFieldType.datetime: return this.populateDtoForDate(record, key, fieldMetadata, dtoRecord);
      case SolidFieldType.int:
      case SolidFieldType.bigint:
      case SolidFieldType.decimal:
        return this.populateDtoForNumber(dtoRecord, fieldMetadata, record, key);
      case SolidFieldType.boolean:
        return this.populateDtoForBoolean(dtoRecord, fieldMetadata, record, key);
      default:
        dtoRecord[fieldMetadata.name] = record[key];
        return dtoRecord;
    }
  }

  private populateDtoForBoolean(dtoRecord: Record<string, any>, fieldMetadata: FieldMetadata, record: Record<string, any>, key: string) {
    const booleanValue = Boolean(record[key]);
    if (typeof booleanValue !== 'boolean') {
      throw new Error(`Invalid boolean value for cell ${key} with value ${record[key]}`);
    }
    dtoRecord[fieldMetadata.name] = booleanValue;
    return dtoRecord;
  }

  private populateDtoForNumber(dtoRecord: Record<string, any>, fieldMetadata: FieldMetadata, record: Record<string, any>, key: string) {
    const numberValue = Number(record[key]);
    if (isNaN(numberValue)) {
      throw new Error(`Invalid number value for cell ${key} with value ${record[key]}`);
    }
    dtoRecord[fieldMetadata.name] = numberValue;
    return dtoRecord;
  }

  private populateDtoForDate(record: Record<string, any>, key: string, fieldMetadata: FieldMetadata, dtoRecord: Record<string, any>) {
    {
      const dateValue = new Date(record[key]);
      if (isNaN(dateValue.getTime())) {
        throw new Error(`Invalid date value for cell ${key} with value ${record[key]}`);
      }
      dtoRecord[fieldMetadata.name] = dateValue;
      return dtoRecord;
    }
  }

  private async populateDtoForRelations(fieldMetadata: FieldMetadata, record: Record<string, any>, key: string, dtoRecord: Record<string, any>) {
    if (!fieldMetadata.relationCoModelSingularName) {
      throw new Error(`Relation coModelSingularName is not defined for relation field ${fieldMetadata.name}`);
    }

    const relatedRecordsIds = await this.getRelatedEntityIdsFromUserKeys(fieldMetadata, record, key);
    if (relatedRecordsIds.length === 0) {
      return dtoRecord; // If no related records found, return the dtoRecord as is
    }

    if (fieldMetadata.relationType === RelationType.manyTomany || fieldMetadata.relationType === RelationType.oneToMany) {
      dtoRecord[`${fieldMetadata.name}Ids`] = relatedRecordsIds;
      dtoRecord[`${fieldMetadata.name}Command`] = RelationFieldsCommand.set; // Reset the relation field association with the related records IDs
    }
    else if (fieldMetadata.relationType === RelationType.manyToOne) {
      dtoRecord[`${fieldMetadata.name}Id`] = relatedRecordsIds.pop(); // For many-to-one relations, we need only one ID
    }
    return dtoRecord;
  }

  private async getRelatedEntityIdsFromUserKeys(fieldMetadata: FieldMetadata, record: Record<string, any>, key: string): Promise<Array<number>> {
    // For many-to-many or one-to-many relations, we expect the record cell to contains a comma-separated list of userKeys
    const relationUserKeys = record[key] ? String(record[key]).split(',').map((userKey: string) => userKey.trim()) : [];
    if (relationUserKeys.length === 0) return [];

    const coModelService = this.getModelService(fieldMetadata.relationCoModelSingularName);
    const coModelWithUserKeyField = await this.modelMetadataService.findOneBySingularName(fieldMetadata.relationCoModelSingularName, ['userKeyField']);
    const coModelUserKeyFieldName = coModelWithUserKeyField?.userKeyField?.name || 'id'; // Default to 'id' if not found


    // Set the relation basic filter dto filters with the userkeys and call the find method of the model service to get the related records
    const relationFilterDto = {
      filters: {
        [coModelUserKeyFieldName]: {
          $in: relationUserKeys, // Use the userKeyFieldName to filter by userKeys
        },
      },
    };

    // From the userKeys, we will get the IDs of the related records using the userKeyFieldName and throw an error if any of the userKeys is not found
    const relatedRecordsResult = await coModelService.find(relationFilterDto);
    if (!relatedRecordsResult || !relatedRecordsResult.records || relatedRecordsResult.records.length === 0 || relatedRecordsResult.records.length !== relationUserKeys.length) {
      throw new Error(`Invalid related records userKey values found for cell ${key} with value ${record[key]}`);
    }
    const relatedRecordsIds = relatedRecordsResult.records.map(record => record.id);
    return relatedRecordsIds;
  }
}