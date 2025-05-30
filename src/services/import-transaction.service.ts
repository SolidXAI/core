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


import { HttpService } from '@nestjs/axios';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { ImportInstructionsResponseDto, StandardImportInstructionsResponseDto } from 'src/dtos/import-instructions.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { MediaWithFullUrl } from 'src/interfaces';
import { Readable } from 'stream';
import { ImportTransaction } from '../entities/import-transaction.entity';
import { CsvService } from './csv.service';
import { ExcelService } from './excel.service';

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

export interface ImportReadResult {
  headers: string[]; // Headers of the CSV file
  data: Record<string, any>[]; // Data records in the current page
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
    readonly httpService: HttpService

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'importTransaction', 'solid-core', moduleRef);
  }

  private readonly logger = new Logger(ImportTransactionService.name);
  saveImportMapping(arg0: number) {
    throw new Error('Method not implemented.');
  }

  async getImportMappingInfo(importTransactionId: number): Promise<ImportMappingInfo> {
    // Load the import transaction for the given ID
    const importTransaction = await this.findOne(importTransactionId, {
      populate: ['modelMetadata', 'modelMetadata.fields'],
      populateMedia: ['fileLocation'],
    });
    if (!importTransaction) {
      throw new Error(`Import transaction with ID ${importTransactionId} not found.`);
    }

    // Get all the importable fields from the model metadata
    const importableFields: ImportableFieldInfo[] = this.fieldsAllowedForImport(importTransaction.modelMetadata.fields).map(field => ({
      name: field.name,
      displayName: field.displayName,
    }));

    // Get the import file stream for the import transaction
    const importFileMediaObject = importTransaction['_media']['fileLocation'][0] as MediaWithFullUrl; // Since there can be only one fileLocation, we can safely access the first element
    if (!importFileMediaObject) {
      throw new Error(`Import file for transaction ID ${importTransactionId} not found.`);
    }
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

  private async getFileRecordsSample(importFileStream: Readable, mimeType: string): Promise<ImportReadResult> {
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



}
