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


import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
// import { Dashboard } from '../entities/dashboard.entity';
import { ListOfValues } from 'src/entities/list-of-values.entity';
import { ListOfValuesMapper } from 'src/mappers/list-of-values-mapper';



@Injectable()
export class ListOfValuesMetadataService extends CRUDService<ListOfValues> {
  private readonly logger = new Logger(this.constructor.name);
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    readonly listOfValuesMapper: ListOfValuesMapper,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ListOfValues, 'default')
    readonly repo: Repository<ListOfValues>,
    readonly moduleRef: ModuleRef,
    readonly moduleMetadataHelperService: ModuleMetadataHelperService,

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'listOfValues', 'solid-core', moduleRef);
  }

  async saveListofValuesToConfig(entity: ListOfValues) {
    if (!entity) {
      this.logger.debug('No entity found in the ListofValuesSubscriber saveDashboardToConfig method');
      return;
    }

    // Validate list of value details
    const listofvalue = entity as ListOfValues;
    const moduleMetadata = entity.module;
    if (!moduleMetadata) {
      throw new Error(`Module metadata not found for listofvalue id ${entity.id}`);
    }

    // Get config file details
    const { filePath, metaData } = await this.getConfigFileDetails(moduleMetadata.name); // sting expected module name
    if (!filePath || !metaData) {
      throw new Error(`Configuration details not found for module: ${moduleMetadata.name}`);
    }

    // Write the dashboard to the config file
    await this.writeToConfig(metaData, listofvalue, filePath);
  }

  async updateListofValuesToConfig(oldentity: ListOfValues, entity: ListOfValues) {
    if (!entity) {
      this.logger.debug('No entity found in the ListofValuesSubscriber saveDashboardToConfig method');
      return;
    }

    // Validate list of value details
    const oldlistofvalue = oldentity as ListOfValues;
    const listofvalue = entity as ListOfValues;
    const moduleMetadata = entity.module;
    if (!moduleMetadata) {
      throw new Error(`Module metadata not found for listofvalue id ${entity.id}`);
    }

    // Get config file details
    const { filePath, metaData } = await this.getConfigFileDetails(moduleMetadata.name); // sting expected module name
    if (!filePath || !metaData) {
      throw new Error(`Configuration details not found for module: ${moduleMetadata.name}`);
    }

    // Write the dashboard to the config file
    await this.updateToConfig(metaData, oldlistofvalue, listofvalue, filePath);
  }



  private async getConfigFileDetails(moduleName: string): Promise<{ filePath: string; metaData: any }> {
    const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Configuration file not found for module: ${moduleName}`);
    }
    const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
    return { filePath, metaData };
  }

  private async writeToConfig(metaData: any, listofvalues: ListOfValues, filePath: string) {
    const dto = await this.listOfValuesMapper.toDto(listofvalues);

    if (!Array.isArray(metaData.listOfValues)) {
      metaData.listOfValues = [];
    }

    if (metaData.listOfValues.length === 0) {
      // Case 1: Empty array → add first item
      metaData.listOfValues.push(dto);
    } else {
      // Case 2: Insert new item right after index 0
      metaData.listOfValues.unshift(dto);
      // metaData.listOfValues.splice(1, 0, dto);
    }

    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);
  }

  private async updateToConfig(metaData: any, oldlistofvalues: ListOfValues, listofvalues: ListOfValues, filePath: string) {
    const newvalue = await this.listOfValuesMapper.toDto(listofvalues);
    const oldvalue = await this.listOfValuesMapper.toDto(oldlistofvalues);

    if (!Array.isArray(metaData.listOfValues)) {
      metaData.listOfValues = [];
    }

    const searchType = oldvalue.type || newvalue.type;
    const searchValue = oldvalue.value || newvalue.value;

    const existingIndex = metaData.listOfValues.findIndex(
      (item: { type: string; value: string }) =>
        item.type === searchType && item.value === searchValue
    );
    if (existingIndex !== -1) {
      // Replace existing match
      metaData.listOfValues[existingIndex] = newvalue;
    }

    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);
  }


}