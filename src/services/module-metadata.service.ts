import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DEFAULT_MEDIA_FILE_STORAGE_DIR } from "src/services/settings/default-settings-provider.service";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";
import { DataSource, EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { ActionMetadata } from '../entities/action-metadata.entity';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { ModuleMetadata } from '../entities/module-metadata.entity';

import { classify } from '../helpers/string.helper';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { DisallowInProduction } from 'src/decorators/disallow-in-production.decorator';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { ModuleMetadataRepository } from 'src/repository/module-metadata.repository';
import { PermissionMetadataSeederService } from 'src/seeders/permission-metadata-seeder.service';
import { DiskFileService } from 'src/services/file';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateModuleMetadataDto } from '../dtos/update-module-metadata.dto';
import {
  ADD_MODULE_COMMAND,
  SchematicService,
} from '../helpers/schematic.service';
import { CommandService } from '../helpers/command.service';
import { SolidRegistry } from '../helpers/solid-registry';
import { isEmbeddedDb } from '../helpers/environment.helper';
import { startNodemonHeartbeat } from '../helpers/nodemon-heartbeat';
import { CodeGenerationOptions, ModuleMetadataConfiguration } from '../interfaces';
import { CrudHelperService } from './crud-helper.service';
import { ModelMetadataService } from './model-metadata.service';
import { SettingService } from './setting.service';

@Injectable()
export class ModuleMetadataService {
  private readonly logger = new Logger(ModuleMetadataService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    // @InjectRepository(ModuleMetadata)
    // private readonly moduleMetadataRepo: Repository<ModuleMetadata>,
    private readonly moduleMetadataRepo: ModuleMetadataRepository,
    private readonly crudHelperService: CrudHelperService,
    private readonly schematicService: SchematicService,
    private readonly commandService: CommandService,
    private readonly fileService: DiskFileService,
    private readonly settingService: SettingService,

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
    var qb: SelectQueryBuilder<ModuleMetadata> = await this.moduleMetadataRepo.createSecurityRuleAwareQueryBuilder(alias)
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

  async find(basicFilterDto: BasicFilterDto) {
    return this.findMany(basicFilterDto);
  }

  async findOneByUserKey(name: string, relations = {}) {
    if (!name) {
      throw new BadRequestException(ERROR_MESSAGES.ENTITY_NAME_REQUIRED);
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
      throw new BadRequestException(ERROR_MESSAGES.ENTITY_ID_REQUIRED);
    }
    const entity = await this.moduleMetadataRepo.findOne({
      where: {
        id: id,
      },
      relations: relations,
    });
    if (!entity) {
      throw new NotFoundException(ERROR_MESSAGES.ENTITY_NOT_FOUND());
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
    } catch (error: any) {
      // console.error('Transaction failed:', error);
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }

  async createInDB(manager: EntityManager, createDto: CreateModuleMetadataDto, files: Express.Multer.File[] = []) {
    if (files.length > 0) {
      const fileStoragePath = this.getFullFilePathForDisk(this.getFileName(files[0]));
      this.fileService.copy(files[0].path, fileStoragePath);
      this.fileService.delete(files[0].path);
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
        actions: [
          {
            displayName: `${module?.name} Home`,
            name: `${module?.name}-home-action`,
            type: "custom",
            domain: "",
            context: "",
            customComponent: `/admin/core/${module?.name}/home`,
            customIsModal: true,
            serverEndpoint: "",
            viewUserKey: "",
            moduleUserKey: module?.name,
            modelUserKey: ""
          }
        ],
        menus: [
          {
            displayName: "Home",
            name: `${module?.name}-home-menu`,
            sequenceNumber: 1,
            actionUserKey: `${module?.name}-home-action`,
            moduleUserKey: module?.name,
            parentMenuItemUserKey: "",
            iconName: "home"
          }
        ],
        views: [],
        emailTemplates: [],
        smsTemplates: [],
        mediaStorageProviders: [],
        securityRules: [],
      };

      // Convert the object to JSON string
      const metadataJson = JSON.stringify(moduleMetaDataJson, null, 2);

      const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(module.name);
      const folderPath = path.dirname(filePath);

      // Ensure the folder exists
      await fs.mkdir(folderPath, { recursive: true });

      // Write the JSON to the file
      await fs.writeFile(filePath, metadataJson);

    } catch (error: any) {
      // console.error('File creation failed:', error);
      this.logger.error('File creation failed:', error);
      throw new Error(ERROR_MESSAGES.FILE_WRITE_FAILED); // Trigger rollback
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
    } catch (error: any) {
      // console.error('Transaction failed:', error);
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }

  async updateInDB(manager: EntityManager, id: number, updateModuleMetadataDto: UpdateModuleMetadataDto, files: Express.Multer.File[] = []) {

    const module = await this.moduleMetadataRepo.preload({
      id,
      ...updateModuleMetadataDto,
    });

    if (!module) {
      throw new NotFoundException(ERROR_MESSAGES.MODULE_ID_NOT_FOUND(id));
    }
    if (files.length > 0) {

      const fileStoragePath = this.getFullFilePathForDisk(this.getFileName(files[0]));
      this.fileService.copy(files[0].path, fileStoragePath);
      this.fileService.delete(files[0].path);
      module.menuIconUrl = fileStoragePath;
    }
    return manager.save(ModuleMetadata, module);
  }

  async updateInFile(module: ModuleMetadata) {
    try {
      const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(module.name);

      // Read the existing JSON file
      let metaData;
      try {
        metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

      } catch (error: any) {
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

    } catch (error: any) {
      // console.error('File creation failed:', error);
      this.logger.error('File creation failed:', error);
      throw new Error(ERROR_MESSAGES.FILE_WRITE_FAILED); // Trigger rollback
    }
  }

  async upsert(updateModuleMetadataDto: UpdateModuleMetadataDto) {
    this.logger.debug(`Module Upsert called for : ${updateModuleMetadataDto.name}`);
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

  @DisallowInProduction()
  async remove(id: number) {
    const entity = await this.findOne(id);
    await this.cleanupOnDelete(entity.id);
    const r = await this.moduleMetadataRepo.remove(entity);
    return r
  }

  async cleanupOnDelete(moduleEntityId: number) {
    const moduleEntity = await this.moduleMetadataRepo.findOne({
      where: {
        // @ts-ignore
        id: moduleEntityId,
      }
    });

    if (!moduleEntity) {
      this.logger.log(`Invalid moduleEntityId: ${moduleEntityId} unable to resolve model metadata`);
      return;
    }
    if (moduleEntity.id !== moduleEntityId) {
      this.logger.log(`Invalid moduleEntityId: ${moduleEntityId} unable to resolve model metadata id ${moduleEntity.id} not matching with the one passed as argument ${moduleEntityId}`);
      return;
    }

    this.logger.log(`Cleaning up for module: ${moduleEntity.name}.`);

    const modulePath = await this.moduleMetadataHelperService.getModulePath(moduleEntity.name);
    const solidUiModulePath = await this.moduleMetadataHelperService.getSolidUiModulePath(moduleEntity.name);
    if (modulePath) {

      this.logger.log(`Module path: ${modulePath}`);
      this.logger.log(`Solid UI module path: ${solidUiModulePath}`);

      // Metadata file to be deleted
      const moduleMetadataPAth = await this.moduleMetadataHelperService.getModuleMetadataFolderPath(moduleEntity.name)
      this.logger.log(`About to delete module metadata path: ${moduleMetadataPAth}`);

      try {
        await fs.rm(modulePath, { recursive: true, force: true });
        if (solidUiModulePath) {
          await fs.rm(solidUiModulePath, { recursive: true, force: true });
          this.logger.log(`Deleted solid-ui module path: ${solidUiModulePath}`);
        }
        await fs.rm(moduleMetadataPAth, { recursive: true, force: true });
        this.logger.log(`Deleted file: ${moduleMetadataPAth}`);
      } catch (error: any) {
        this.logger.error(`Error deleting file: ${moduleMetadataPAth}`, error);
        throw new Error(ERROR_MESSAGES.FILE_DELETE_FAILED); // Trigger rollback
      }
    }
    await this.cleanupAssociatedMenusAndActions(moduleEntity.id);
  }

  private async cleanupAssociatedMenusAndActions(moduleId: number) {
    const actionRepo = this.dataSource.getRepository(ActionMetadata);
    const menuRepo = this.dataSource.getRepository(MenuItemMetadata);

    const actions = await actionRepo.find({
      where: {
        module: { id: moduleId },
      },
    });
    const actionIds = actions.map((action) => action.id);

    const menus = await this.findMenusForModuleCleanup(moduleId, actionIds);
    if (menus.length > 0) {
      const menuIds = menus.map((menu) => menu.id).filter(Boolean);
      for (const menu of menus) {
        if (menu.roles?.length) {
          await this.dataSource
            .createQueryBuilder()
            .relation(MenuItemMetadata, 'roles')
            .of(menu.id)
            .remove(menu.roles.map((role) => role.id));
        }
      }

      if (menuIds.length > 0) {
        await menuRepo
          .createQueryBuilder()
          .update(MenuItemMetadata)
          .set({ parentMenuItem: null as any })
          .where('id IN (:...menuIds)', { menuIds })
          .execute();

        await menuRepo
          .createQueryBuilder()
          .delete()
          .from(MenuItemMetadata)
          .where('id IN (:...menuIds)', { menuIds })
          .execute();
      }

      this.logger.log(`Deleted ${menus.length} menu metadata record(s) for module id ${moduleId}`);
    }

    if (actions.length > 0) {
      await actionRepo.remove(actions);
      this.logger.log(`Deleted ${actions.length} action metadata record(s) for module id ${moduleId}`);
    }
  }

  private async findMenusForModuleCleanup(moduleId: number, actionIds: number[]) {
    const menuRepo = this.dataSource.getRepository(MenuItemMetadata);
    const menusById = new Map<number, MenuItemMetadata>();

    const rootMenus = await menuRepo.find({
      where: [
        {
          module: { id: moduleId },
        },
        ...(actionIds.length > 0
          ? [
            {
              action: { id: In(actionIds) },
            },
          ]
          : []),
      ],
      relations: ['roles', 'action', 'parentMenuItem'],
    });

    rootMenus.forEach((menu) => menusById.set(menu.id, menu));

    let parentIds = rootMenus.map((menu) => menu.id);
    while (parentIds.length > 0) {
      const childMenus = await menuRepo.find({
        where: {
          parentMenuItem: { id: In(parentIds) },
        },
        relations: ['roles', 'action', 'parentMenuItem'],
      });

      const nextParentIds: number[] = [];
      for (const childMenu of childMenus) {
        if (!menusById.has(childMenu.id)) {
          menusById.set(childMenu.id, childMenu);
          nextParentIds.push(childMenu.id);
        }
      }

      parentIds = nextParentIds;
    }

    return Array.from(menusById.values());
  }

  async deleteMany(ids: number[]): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
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
      if (!entity) {
        this.logger.warn(`Module metadata with id ${id} not found. Skipping deleteMany cleanup for this id.`);
        continue;
      }

      await this.cleanupOnDelete(entity.id);
      removedEntities.push(await this.moduleMetadataRepo.remove(entity));
    }

    return removedEntities
  }

  async refreshPermission() {
    await this.permissionsSeederService.seed();
    return true
  }

  @DisallowInProduction()
  async seedModuleFromMetadata(moduleId: number) {
    const module = await this.findOne(moduleId);
    const seeder = this.solidRegistry
      .getSeeders()
      .filter((registeredSeeder) => registeredSeeder.name === 'ModuleMetadataSeederService')
      .map((registeredSeeder) => registeredSeeder.instance)
      .pop();

    if (!seeder || typeof seeder.seed !== 'function') {
      throw new NotFoundException('ModuleMetadataSeederService not found. Cannot seed module metadata.');
    }

    await seeder.seed({
      modulesToSeed: [module.name],
      seedGlobalMetadata: false,
    });

    return {
      success: true,
      moduleName: module.name,
      message: `Seeded metadata for module ${module.name}.`,
    };
  }

  @DisallowInProduction()
  async generateCodeViaCtl(moduleId: number): Promise<string> {
    const module = await this.findOne(moduleId);
    const isEmbedded = isEmbeddedDb();

    // When using an embedded PGlite database, the single-connection limit means
    // a spawned `solid refresh-module` subprocess cannot get its own DB connection
    // while the API server is already holding it. Fall back to in-process code
    // generation (which reuses the existing connection) and only spawn solidctl
    // for the UI module scaffold (which does not need a database connection).
    if (isEmbedded) {
      this.logger.log('Embedded database detected — generating API code in-process');
      // Prevent nodemon from restarting the server while schematics write files.
      // The heartbeat touches a watched file every 1.5 s (nodemon delay is 2 s),
      // keeping the delay from expiring during DB queries between schematic runs.
      const heartbeat = startNodemonHeartbeat(path.join(process.cwd(), 'src'));
      try {
        const apiOutput = await this.generateCode({
          moduleUserKey: module.name,
          dryRun: false,
        });
        let uiOutput = '';
        try {
          uiOutput = await this.commandService.executeCommandWithArgs({
            command: 'npx',
            args: ['@solidxai/solidctl@latest', 'generate', 'ui-module', `--name=${module.name}`],
            cwd: path.join(process.cwd(), '..'),
          });
        } catch (error) {
          this.logger.warn('UI module scaffold failed (solidctl may be outdated); API code was generated successfully.');
        }
        return `${apiOutput}\n${uiOutput}`;
      } finally {
        heartbeat.stop();
      }
    }

    return this.commandService.executeCommandWithArgs({
      command: 'npx',
      args: ['@solidxai/solidctl@latest', 'generate', 'module', `--name=${module.name}`],
      cwd: path.join(process.cwd(), '..'),
    });
  }

  @DisallowInProduction()
  async generateCode(options: CodeGenerationOptions): Promise<string> {
    if (!options.moduleId && !options.moduleUserKey) {
      throw new BadRequestException(ERROR_MESSAGES.MODEL_REQUIRED_FOR_CODE_GENERATION);
    }
    const module = options.moduleId ? await this.findOne(options.moduleId) : await this.findOneByUserKey(options.moduleUserKey);

    // Check if the module exists
    if (!module) {
      throw new NotFoundException(ERROR_MESSAGES.MODULE_ID_NOT_FOUND(options.moduleId));
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
      throw new BadRequestException(ERROR_MESSAGES.MODEL_REQUIRED_FOR_CODE_GENERATION);
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
      const output = await this.modelMetadataService.handleGenerateCode(codeGenerationOptions);
      this.logger.debug(`Schematic output : ${output}`);
      outputLines.push(output)
    }
    return outputLines.join('\n');
  }

  private getFullFilePathForDisk(fileName: string): string {
    const base = this.settingService.getConfigValue<SolidCoreSetting>("fileStorageDir")
      || DEFAULT_MEDIA_FILE_STORAGE_DIR;
    if (path.isAbsolute(fileName) || fileName.startsWith(`${base}/`)) {
      return fileName;
    }
    return `${base}/${fileName}`;
  }

  private getFileName(file: Express.Multer.File): string {
    return `${file.filename}-${file.originalname}`;
  }

}
