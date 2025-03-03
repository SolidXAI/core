import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { ModuleMetadata } from '../entities/module-metadata.entity';

import { classify } from '@angular-devkit/core/src/utils/strings';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths
import { PermissionMetadataSeederService } from 'src/seeders/permission-metadata-seeder.service';
import { FileService } from 'src/services/file.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateModuleMetadataDto } from '../dtos/update-module-metadata.dto';
import {
  ADD_MODULE_COMMAND,
  SchematicService,
} from '../helpers/schematic.service';
import { SolidRegistry } from '../helpers/solid-registry';
import { CodeGenerationOptions, ModuleMetadataConfiguration } from '../interfaces';
import { CrudHelperService } from './crud-helper.service';
import { ModelMetadataService } from './model-metadata.service';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';

@Injectable()
export class ModuleMetadataService {
  private readonly logger = new Logger(ModuleMetadataService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ModuleMetadata)
    private readonly moduleMetadataRepo: Repository<ModuleMetadata>,
    private readonly crudHelperService: CrudHelperService,
    private readonly schematicService: SchematicService,
    private readonly configService: ConfigService,
    private readonly fileService: FileService,
    private readonly permissionsSeederService: PermissionMetadataSeederService,
    @Inject(forwardRef(() => ModelMetadataService))
    private readonly modelMetadataService: ModelMetadataService,
    private readonly solidRegistry: SolidRegistry,
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
  ) { }

  async findMany(basicFilterDto: BasicFilterDto) {
    const alias = 'moduleMetadata';
    // Extract the required keys from the input query
    let { limit, offset } = basicFilterDto;

    // Create above query on pincode table using query builder
    var qb: SelectQueryBuilder<ModuleMetadata> = this.moduleMetadataRepo.createQueryBuilder(alias)
    qb = await this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);

    // Get the records and the count
    const [entities, count] = await qb.getManyAndCount();

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(count / limit);

    const nextPage = currentPage < totalPages ? currentPage + 1 : null;
    const prevPage = currentPage > 1 ? currentPage - 1 : null;

    const r = {
      meta: {
        totalRecords: count,
        currentPage: currentPage,
        nextPage: nextPage,
        prevPage: prevPage,
        totalPages: totalPages,
        perPage: +limit,
      },
      records: entities
    };
    return r
  }

  async findOneByUserKey(name: string, relations = {}) {
    if (!name) {
      throw new BadRequestException('name is required for finding entity');
    }
    const entity = await this.moduleMetadataRepo.findOne({
      where: {
        name: name,
      },
      relations: relations,
    });
    return entity;
  }

  async findOne(id: number, relations = {}) {
    if (!id) {
      throw new BadRequestException('ID is required for finding entity');
    }
    const entity = await this.moduleMetadataRepo.findOne({
      where: {
        id: id,
      },
      relations: relations,
    });
    if (!entity) {
      throw new NotFoundException(`entity #${id} not found`);
    }
    return entity;
  }

  async create(createDto: CreateModuleMetadataDto, files: Express.Multer.File[] = []) {
    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        // Step 1: Write initial data to the database
        const module = await this.createInDB(manager, createDto, files);
        await this.createInFile(module);
        return module
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }
  async createInDB(manager: EntityManager, createDto: CreateModuleMetadataDto, files: Express.Multer.File[] = []) {
    if (files.length > 0) {
      const fileStoragePath = this.getFileSysytemFullFilePath(this.getFileName(files[0]));
      this.fileService.copyFile(files[0].path, fileStoragePath);
      this.fileService.deleteFile(files[0].path);
      createDto.menuIconUrl = fileStoragePath;
    }
    const moduleMetadata = this.moduleMetadataRepo.create(createDto);
    return manager.save(moduleMetadata); // Use the provided manager to perform DB operations
  }

  async createInFile(module: ModuleMetadata) {
    try {
      // Prepare the metadata JSON structure
      const moduleMetaDataJson: ModuleMetadataConfiguration = {
        moduleMetadata: {
          name: module?.name,
          displayName: module?.displayName,
          description: module?.description,
          defaultDataSource: module?.defaultDataSource,
          menuIconUrl: module?.menuIconUrl,
          menuSequenceNumber: module?.menuSequenceNumber,
          isSystem: module?.isSystem,
          models: [],
        },
        roles: [],
        users: [],
        actions: [],
        menus: [],
        views: [],
        emailTemplates: [],
        smsTemplates: [],
        mediaStorageProviders: [],
      };

      // Convert the object to JSON string
      const metadataJson = JSON.stringify(moduleMetaDataJson, null, 2);

      // Create the folder path inside 'module-metadata'
      const folderPath = path.resolve(process.cwd(), 'module-metadata', module.name);
      const filePath = this.moduleMetadataHelperService.getModuleMetadataFilePath(module.name);

      // Ensure the folder exists
      await fs.mkdir(folderPath, { recursive: true });

      // Write the JSON to the file
      await fs.writeFile(filePath, metadataJson);

    } catch (error) {
      console.error('File creation failed:', error);
      throw new Error('File creation failed, rolling back transaction'); // Trigger rollback
    }
  }

  async update(id: number, updateModuleMetadataDto: UpdateModuleMetadataDto, files: Express.Multer.File[] = []) {
    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        // Step 1: Write initial data to the database
        const module = await this.updateInDB(manager, id, updateModuleMetadataDto, files);
        await this.updateInFile(module);
        return module
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }


  async updateInDB(manager: EntityManager, id: number, updateModuleMetadataDto: UpdateModuleMetadataDto, files: Express.Multer.File[] = []) {

    const module = await this.moduleMetadataRepo.preload({
      id,
      ...updateModuleMetadataDto,
    });

    if (!module) {
      throw new NotFoundException(`Module ${id} not found`);
    }
    if (files.length > 0) {

      const fileStoragePath = this.getFileSysytemFullFilePath(this.getFileName(files[0]));
      this.fileService.copyFile(files[0].path, fileStoragePath);
      this.fileService.deleteFile(files[0].path);
      module.menuIconUrl = fileStoragePath;
    }
    return manager.save(ModuleMetadata, module);
  }

  async updateInFile(module: ModuleMetadata) {
    try {
      const filePath = this.moduleMetadataHelperService.getModuleMetadataFilePath(module.name);

      // Read the existing JSON file
      let metaData;
      try {
        metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

      } catch (error) {
        metaData = {
          moduleMetadata: {
            name: null,
            displayName: null,
            description: null,
            defaultDataSource: null,
            menuIconUrl: null,
            menuSequenceNumber: null,
            isSystem: null,
            models: [],
          },
          roles: [],
          users: [],
          actions: [],
          menus: [],
          views: [],
          emailTemplates: [],
          smsTemplates: [],
          mediaStorageProviders: [],
        };
      }


      metaData.moduleMetadata.name = module?.name;
      metaData.moduleMetadata.displayName = module?.displayName;
      metaData.moduleMetadata.description = module?.description;
      metaData.moduleMetadata.defaultDataSource = module?.defaultDataSource;
      metaData.moduleMetadata.menuIconUrl = module?.menuIconUrl;
      metaData.moduleMetadata.menuSequenceNumber = module?.menuSequenceNumber;
      metaData.moduleMetadata.isSystem = module?.isSystem;

      // Write the JSON to the file
      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);

    } catch (error) {
      console.error('File creation failed:', error);
      throw new Error('File creation failed, rolling back transaction'); // Trigger rollback
    }
  }


  async upsert(updateModuleMetadataDto: UpdateModuleMetadataDto) {
    this.logger.log(`Module Upsert called for : ${updateModuleMetadataDto.name}`);
    // First check if module already exists using name
    const existingModuleMetadata = await this.moduleMetadataRepo.findOne({
      where: {
        name: updateModuleMetadataDto.name
      }
    })
    const { models, ...restUpdateModuleMetadataDto } = updateModuleMetadataDto;
    // if found
    if (existingModuleMetadata) {
      const updatedModuleMetadata = { ...existingModuleMetadata, ...restUpdateModuleMetadataDto };
      return this.moduleMetadataRepo.save(updatedModuleMetadata);
    }
    // if not found - create new 
    else {
      const moduleMetadata = this.moduleMetadataRepo.create(restUpdateModuleMetadataDto);
      return this.moduleMetadataRepo.save(moduleMetadata);
    }
  }




  async removeByName(name: string) {
    const entity = await this.findOneByUserKey(name);
    if (entity) {
      await this.moduleMetadataRepo.remove(entity);
    }
  }

  async remove(id: number) {
    const entity = await this.findOne(id);
    return this.moduleMetadataRepo.remove(entity);
  }

  async deleteMany(ids: number[]): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error('At least one ID is required for deletion');
    }
    const removedEntities = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const entity = await this.moduleMetadataRepo.findOne({
        where: {
          //@ts-ignore
          id: id,
        }
      });
      // if (!entity) {
      //   throw new Error(`Entity with id ${id} not found`);
      // }
      removedEntities.push(await this.moduleMetadataRepo.remove(entity));
    }

    return removedEntities
  }

  async refreshPermission() {
    await this.permissionsSeederService.seed();
    return true
  }

  async generateCode(options: CodeGenerationOptions): Promise<string> {    
    if (!options.moduleId && !options.moduleUserKey) {
      throw new BadRequestException('Module ID or Module Name is required for generating code');
    }
    const module = options.moduleId ? await this.findOne(options.moduleId) : await this.findOneByUserKey(options.moduleUserKey);

    // Check if the module exists
    if (!module) {
      throw new NotFoundException(`Module ${options.moduleId} not found`);
    }

    // Check if the module name already exists and is loaded
    const moduleInstance = this.solidRegistry.getModule(`${classify(module.name)}Module`);
    
    if (!moduleInstance) {
      const addModuleOutput = await this.generateAddModuleCode(options);
      const refreshModuleOutput = await this.generateRefreshModuleCode(options);
      return `${addModuleOutput}\n${refreshModuleOutput}`;
    } else {
      return await this.generateRefreshModuleCode(options);
    }
  }

  private async generateAddModuleCode(options: CodeGenerationOptions = { dryRun: false }): Promise<string> {
    if (!options.moduleId && !options.moduleUserKey) {
      throw new BadRequestException('Module ID or Module Name is required for generating code');
    }
    const module = options.moduleId ? await this.findOne(options.moduleId) : await this.findOneByUserKey(options.moduleUserKey);

    //Generate the module
    const output = await this.schematicService.executeSchematicCommand(
      ADD_MODULE_COMMAND,
      { module: module.name },
      options.dryRun ?? false
    );
    this.logger.debug(`Schematic output : ${output}`);
    return output;
  }

  private async generateRefreshModuleCode(options: CodeGenerationOptions): Promise<string> {
    const query = {
      relations: { models: { fields: true } },
    };
    const module = options.moduleId ? await this.findOne(options.moduleId, query.relations) : await this.findOneByUserKey(options.moduleUserKey, query.relations);
    const outputLines = []
    for (const model of module.models) {
      const codeGenerationOptions = {
        modelId: model.id,
        dryRun: options.dryRun,
      };
      const output = await this.modelMetadataService.generateCode(codeGenerationOptions);
      this.logger.debug(`Schematic output : ${output}`);
      outputLines.push(output)
    }
    return outputLines.join('\n');
  }

  private getFileSysytemFullFilePath(fileName: string): string {
    return `${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
  }



  private getFileName(file: Express.Multer.File): string {
    return `${file.filename}-${file.originalname}`;
  }

}
