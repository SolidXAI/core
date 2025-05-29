import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';


import { ImportTransaction } from '../entities/import-transaction.entity';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { Field } from 'mysql2';
import { ExcelService } from './excel.service';
import { CsvService } from './csv.service';
import { ImportInstructionsResponseDto, StandardImportInstructionsResponseDto } from 'src/dtos/import-instructions.dto';

interface ImportTemplateFileInfo {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
}

// export interface ImportInstruction {
//   standard: Record<StandardImportInstructionKeys, any>;
//   custom: string[];
// }

// enum StandardImportInstructionKeys {
//   REQUIRED_FIELDS = 'requiredFields',
//   DATE_FIELDS = 'dateFields',
//   DATE_TIME_FIELDS = 'dateTimeFields',
//   NUMBER_FIELDS = 'numberFields',
//   EMAIL_FIELDS = 'emailFields',
//   REGEX_FIELDS = 'regexFields',
//   JSON_FIELDS = 'jsonFields',
//   BOOLEAN_FIELDS = 'booleanFields',
// }


export enum ImportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
}

export interface ImportMappingInfo {
  sampleImportedRecordInfo: SampleImportedRecordInfo[];
  importableFields: ImportableFieldInfo[];
}

export interface SampleImportedRecordInfo {
  cellHeader : string; // The header of the cell in the import file
  cellValue: string; // The value of the cell in the import file
  defaultMappedFieldName: string; // The default mapped field name in the model metadata
}
export interface ImportableFieldInfo {
  name: string;
  displayName: string;
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
    
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'importTransaction', 'solid-core', moduleRef);
  }
  
  private readonly logger = new Logger(ImportTransactionService.name);
  saveImportMapping(arg0: number) {
    throw new Error('Method not implemented.');
  }

  async getImportMappingInfo(importTransactionId: number): Promise<ImportMappingInfo> {
    // Read the file associated with the import transaction
    // Call import transaction service findOne with populatemedata for the import transaction ID
    const importTransaction = await this.findOne(importTransactionId, {
      populate : ['modelMetadata', 'modelMetadata.fields'],
      populateMedia: ['fileLocation'],
    });
    if (!importTransaction) {
      throw new Error(`Import transaction with ID ${importTransactionId} not found.`);
    }

    // Add all the fields other than media fields, computed fields, password fields, rich text fields, uuid fields as importable fields
    const importableFields: ImportableFieldInfo[] = this.fieldsAllowedForImport(importTransaction.modelMetadata.fields).map(field => ({
      name: field.name,
      displayName: field.displayName,
    }));

    // Read the file url
    const fileUrl = importTransaction['_media']['fileLocation'][0]['_full_url'];
    if (!fileUrl) {
      throw new Error(`File URL for import transaction with ID ${importTransactionId} not found.`);
    }
    this.logger.debug(`File URL for import transaction with ID ${importTransactionId}: ${fileUrl}`);
  

    // Depending upon the file format, read the file and extract the headers
    

    // Extract the headers from the file
    // Extract the 1st row of the file to get sample data
    // Create a response of type ImportMappingInfo
    return {
      sampleImportedRecordInfo: [], // This will hold the sample data from the file
      importableFields: importableFields, // This will hold the fields that can be imported
    } ;
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
      if (field.regexPattern ) {
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
    } ;
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
