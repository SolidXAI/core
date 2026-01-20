import { Injectable } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { ListOfValuesMapper } from 'src/mappers/list-of-values-mapper';
import { ListOfValuesRepository } from 'src/repository/list-of-values.repository';
import { ListOfValues } from '../entities/list-of-values.entity';


@Injectable()
export class ListOfValuesService extends CRUDService<ListOfValues> {
  logger: any;
  // moduleMetadataHelperService: any;
  // listOfValuesMapper: any;
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ListOfValues, 'default')
    // readonly repo: Repository<ListOfValues>,
    readonly repo: ListOfValuesRepository,
    readonly moduleRef: ModuleRef,
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    readonly listOfValuesMapper: ListOfValuesMapper,

  ) {
    super(entityManager, repo, 'listOfValues', 'solid-core', moduleRef);
  }
  async findOneByValueAndType(lovValue: string, lovType: string) {
    return await this.repo.findOne({
      where: {
        value: lovValue,
        type: lovType,
      },
    });
  }

  async findAll(): Promise<ListOfValues[]> {
    return await this.repo.find();
  }

  async upsert(updateListOfValuesDto: any) {
    // First check if module already exists using name
    const existingListOfValue = await this.repo.findOne({
      where: {
        value: updateListOfValuesDto.value
      }
    })

    // if found
    if (existingListOfValue) {
      const updatedListOfValuesDto = { ...existingListOfValue, ...updateListOfValuesDto };
      return this.repo.save(updatedListOfValuesDto);
    }
    // if not found - create new 
    else {
      const listOfValue = this.repo.create(updateListOfValuesDto);
      return this.repo.save(listOfValue);
    }
  }


  async saveListofValuesToConfig(entity: ListOfValues) {
    if (!entity) {
      this.logger.debug('No entity found in the ListofValuesSubscriber saveListofvalueToConfig method');
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

    // Write the listofvalue to the config file
    await this.writeToConfig(metaData, listofvalue, filePath);
  }

  async updateListofValuesToConfig(oldentity: ListOfValues, entity: ListOfValues) {
    if (!entity) {
      this.logger.debug('No entity found in the ListofValuesSubscriber saveListofvalueToConfig method');
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

    // Write the listofvalue to the config file
    await this.updateToConfig(metaData, oldlistofvalue, listofvalue, filePath);
  }

  async deleteListOfValuesFromConfig(entity: ListOfValues) {
    if (!entity) {
      this.logger.debug('No entity found in the ListofValuesSubscriber saveListofvalueToConfig method');
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

    // delete the listofvalue to the config file
    await this.deleteFromConfig(metaData, listofvalue, filePath);
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

    // Match by type + value + module
    const existingIndex = metaData.listOfValues.findIndex(
      (item: { type: string; value: string; module: number }) =>
        item.type === dto.type &&
        item.value === dto.value &&
        item.module === dto.module
    );

    if (existingIndex !== -1) {
      // Replace existing entry
      metaData.listOfValues[existingIndex] = dto;
    } else {
      // Insert new entry
      // metaData.listOfValues.unshift(dto);

      if (metaData.listOfValues.length === 0) {
        // Case 1: Empty array → add first item
        metaData.listOfValues.push(dto);
      } else {
        // Case 2: Insert new item right after index 0
        metaData.listOfValues.unshift(dto);
      }

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
    const searchModule = oldvalue.module || newvalue.module;

    const existingIndex = metaData.listOfValues.findIndex(
      (item: { type: string; value: string; module: number }) =>
        item.type === searchType && item.value === searchValue && item.module === searchModule
    );
    if (existingIndex !== -1) {
      // Replace existing match
      metaData.listOfValues[existingIndex] = newvalue;
    }

    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);
  }

  private async deleteFromConfig(metaData: any, listofvalues: ListOfValues, filePath: string) {
    const dto = await this.listOfValuesMapper.toDto(listofvalues);

    if (!Array.isArray(metaData.listOfValues)) {
      metaData.listOfValues = [];
    }

    // Match by type + value + module
    const existingIndex = metaData.listOfValues.findIndex(
      (item: { type: string; value: string; module: number }) =>
        item.type === dto.type &&
        item.value === dto.value &&
        item.module === dto.module
    );

    if (existingIndex !== -1) {
      // Remove the item
      metaData.listOfValues.splice(existingIndex, 1);
      this.logger.debug(`Deleted LOV ${dto.type}:${dto.value} (module ${dto.module}) from config`);
    } else {
      this.logger.warn(
        `LOV ${dto.type}:${dto.value} (module ${dto.module}) not found in config during delete`
      );
    }
    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);

  }
}
