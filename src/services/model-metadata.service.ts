import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { existsSync } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { ModuleMetadata } from '../entities/module-metadata.entity';

import { kebabCase } from 'lodash';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { DisallowInProduction } from 'src/decorators/disallow-in-production.decorator';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { NavigationDto } from 'src/dtos/navigation.dto';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateModelMetaDataDto } from '../dtos/update-model-metadata.dto';
import { ActionMetadata } from '../entities/action-metadata.entity';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { ImportTransactionErrorLog } from '../entities/import-transaction-error-log.entity';
import { ImportTransaction } from '../entities/import-transaction.entity';
import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { UserViewMetadata } from '../entities/user-view-metadata.entity';
import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { RoleMetadata } from '../entities/role-metadata.entity';
import { ViewMetadata } from '../entities/view-metadata.entity';
import { DashboardUserLayout } from '../entities/dashboard-user-layout.entity';
import { SecurityRule } from '../entities/security-rule.entity';
import { SavedFilters } from '../entities/saved-filters.entity';
import { CommandService } from '../helpers/command.service';
import {
  REFRESH_MODEL_COMMAND,
  REMOVE_FIELDS_COMMAND,
  SchematicService
} from '../helpers/schematic.service';
import { classify } from '../helpers/string.helper';
import { CodeGenerationOptions } from '../interfaces';
import { CrudHelperService, FilterCombinator } from './crud-helper.service';
import { CRUDService } from './crud.service';
import { FieldMetadataService } from './field-metadata.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { SolidIntrospectService } from './solid-introspect.service';
import { SolidTsMorphService } from './solid-ts-morph.service';

@Injectable()
export class ModelMetadataService {
  private logger = new Logger('ModelMetadataService');
  constructor(
    // @InjectRepository(ModelMetadata)
    // private readonly modelMetadataRepo: Repository<ModelMetadata>,
    // @InjectRepository(FieldMetadata)
    // private readonly fieldMetadataRepo: Repository<FieldMetadata>,
    @Inject(forwardRef(() => ModelMetadataRepository))
    private readonly modelMetadataRepo: ModelMetadataRepository,
    private readonly fieldMetadataRepo: FieldMetadataRepository,
    private readonly schematicService: SchematicService,
    private readonly commandService: CommandService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly crudHelperService: CrudHelperService,
    private readonly mediaStorageProviderMetadataService: MediaStorageProviderMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    readonly introspectService: SolidIntrospectService,
    private readonly solidTsMorphService: SolidTsMorphService,

    // No longer used.
    // private readonly generateCodePublihser: GenerateCodePublisherDatabase,
  ) { }

  async find(basicFilterDto: BasicFilterDto) {
    return this.findMany(basicFilterDto);
  }

  async findMany(basicFilterDto: BasicFilterDto): Promise<any> {
    const alias = 'modelMetadata';
    const { limit, offset } = basicFilterDto;

    const qb: SelectQueryBuilder<ModelMetadata> = await this.modelMetadataRepo.createSecurityRuleAwareQueryBuilder(alias);

    if (basicFilterDto.groupBy?.length) {
      const groupFilterQb = this.crudHelperService.buildFilterQuery(
        qb, basicFilterDto, alias, undefined, undefined, undefined,
        FilterCombinator.AND, false, false
      );
      return this.crudHelperService.executeGroupPipeline(
        groupFilterQb, basicFilterDto, alias,
        () => this.modelMetadataRepo.createSecurityRuleAwareQueryBuilder(alias)
      );
    }

    const filteredQb = this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);
    const [entities, count] = await filteredQb.getManyAndCount();
    return this.crudHelperService.pagedResponse(offset, limit, count, entities);
  }

  async findOne(id: any, query?: any) {
    // const { fields, filters, populate } = basicFilterDto;
    const entity = await this.modelMetadataRepo.findOne({
      where: {
        id: id,
      },
      relations: query?.populate, //FIXME: Check with jenender and change to relations to avoid confusion
    });
    if (!entity) {
      throw new NotFoundException(ERROR_MESSAGES.ENTITY_NOT_FOUND(`#${id}`));
    }
    return entity;
  }

  async findOneBySingularName(singularName: string, relations = {}) {
    const entity = await this.modelMetadataRepo.findOne({
      where: {
        singularName: singularName,
      },
      relations: relations,
    });
    if (!entity) {
      throw new NotFoundException(ERROR_MESSAGES.ENTITY_NOT_FOUND(singularName));
    }
    return entity;
  }

  async findOneByUserKey(singularName: string, relations = {}) {
    const entity = await this.modelMetadataRepo.findOne({
      where: {
        singularName: singularName,
      },
      relations: relations,
    });
    if (!entity) {
      throw new NotFoundException(ERROR_MESSAGES.ENTITY_NOT_FOUND(singularName));
    }
    return entity;
  }

  async create(createDto: CreateModelMetadataDto) {

    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        const modelRepository = manager.getRepository(ModelMetadata);
        const fieldRepository = manager.getRepository(FieldMetadata);

        // Step 1: Write initial data to the database
        const model = await this.createInDB(manager, createDto);
        await this.createInFile(model.id, modelRepository);

        await this.handleInverseRelationFieldsUpdates(model, fieldRepository, modelRepository);

        return model
      });
    } catch (error: any) {
      // console.error('Transaction failed:', error);
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }

  // Iterate through the fields in the createDto & get all the relation fields which have create inverse as true
  private async handleInverseRelationFieldsUpdates(model: ModelMetadata, fieldRepository: Repository<FieldMetadata>, modelRepository: Repository<ModelMetadata>) {
    const fields: FieldMetadata[] = await this.getRelationInverseFields(model.id, fieldRepository);

    // Call a function which will iterate through each field and create an inverse field entry for the respective model i.e call updateInverseField on the related model
    for (const field of fields) {
      await this.fieldMetadataService.updateInverseField(field, fieldRepository, modelRepository);
    }
  }

  async update(id: number, updateModelMetaDataDto: UpdateModelMetaDataDto) {
    //To DO start the transaction 
    // call create In db
    // call createInfile

    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        const modelRepository = manager.getRepository(ModelMetadata);
        const fieldRepository = manager.getRepository(FieldMetadata);

        // Step 1: Write initial data to the database
        const model = await this.updateInDb(manager, id, updateModelMetaDataDto)
        await this.updateInFile(model.id, modelRepository);

        await this.handleInverseRelationFieldsUpdates(model, fieldRepository, modelRepository);

        // return model
      });
    } catch (error: any) {
      // console.error('Transaction failed:', error);
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }

  async createInDB(manager: EntityManager, createDto: CreateModelMetadataDto) {

    //Save the model
    const resolvedModule = await this.dataSource
      .getRepository(ModuleMetadata)
      .findOne({
        where: {
          id: createDto['moduleId'],
        },
        relations: {},
      });
    createDto['module'] = resolvedModule;

    if (createDto['parentModelId']) {
      const resolvedParentModel = await this.dataSource
        .getRepository(ModelMetadata)
        .findOne({
          where: {
            id: createDto['parentModelId'],
          },
          relations: {},
        });
      createDto['parentModel'] = resolvedParentModel;
    }

    const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = createDto;
    const modelMetadata = this.modelMetadataRepo.create(modelMetaDataWithoutFields);
    let model = await manager.save(modelMetadata);

    // iterate over all fields and upsert. 
    let userKeyField = null;
    const listViewLayout = [];
    const formViewLayout = [];
    const treeViewLayout = [];

    for (let k = 0; k < fieldsMetadata.length; k++) {
      const fieldMetadata = fieldsMetadata[k];

      // TODO: resolve model & mediaStorageProvider. 
      fieldMetadata['model'] = model;
      if (fieldMetadata.mediaStorageProviderId) {
        fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOne(fieldMetadata.mediaStorageProviderId);
      }
      // console.log(fieldMetadata.displayName);
      // this.logger.debug(fieldMetadata.displayName);

      const fieldMetadataObject = this.fieldMetadataRepo.create(fieldMetadata);
      const affectedField = await manager.save(fieldMetadataObject);

      if (fieldMetadata.isUserKey) {
        userKeyField = affectedField;
      }
      listViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}` } })
      formViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}` } })
      treeViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}` } })

    }

    // Now that we have created fields & model update the model to stamp the userKeyField. 
    if (userKeyField) {
      modelMetaDataWithoutFields['userKeyField'] = userKeyField;
      const updatedModelMetadataDto = this.modelMetadataRepo.merge(model, modelMetaDataWithoutFields);
      model = await manager.save(updatedModelMetadataDto);
    }

    return model;
  }

  async createInFile(modelId: any, repo: Repository<ModelMetadata>) {
    try {
      const model = await repo.findOne({
        where: {
          id: modelId,
        },
        relations: ["fields", "fields.mediaStorageProvider", "module", "parentModel"], //FIXME: Check with jenender and change to relations to avoid confusion
      });

      const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module.name);
      const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

      const modelMetaData = {
        singularName: model.singularName,
        pluralName: model.pluralName,
        displayName: model.displayName,
        description: model.description,
        dataSource: model.dataSource,
        dataSourceType: model.dataSourceType,
        tableName: model.tableName,
        userKeyFieldUserKey: model.fields.find(field => field.isUserKey)?.name,
        isChild: model?.isChild,
        legacyTableType: model?.legacyTableType,
        parentModelUserKey: model?.parentModel?.singularName,
        enableAuditTracking: model?.enableAuditTracking,
        enableSoftDelete: model?.enableSoftDelete,
        draftPublishWorkflow: model?.draftPublishWorkflow,
        internationalisation: model?.internationalisation,
        fields: []
      }

      for (let i = 0; i < model.fields.length; i++) {
        const field = model.fields[i];
        if (field.isSystem) continue;
        const fieldObject: Record<string, any> = await this.fieldMetadataService.createFieldConfig(field);
        modelMetaData.fields.push(fieldObject);
      }
      // Update the `models` array
      metaData.moduleMetadata.models.push(modelMetaData);

      // Write the updated object back to the file
      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);

    } catch (error: any) {
      // console.error('File creation failed:', error);
      this.logger.error('File creation failed:', error);
      throw new Error(ERROR_MESSAGES.FILE_WRITE_FAILED); // Trigger rollback
    }
  }

  async updateInDb(manager: EntityManager, id: number, updateModelMetaDataDto: UpdateModelMetaDataDto) {

    const { fields: fieldsMetadata, ...modelMetaDataWithoutFields } = updateModelMetaDataDto;
    const modelRepo = manager.getRepository(ModelMetadata);
    const fieldRepo = manager.getRepository(FieldMetadata);
    // 1. Update the model metadata without fields
    let existingModel = await modelRepo.findOne({
      where: {
        singularName: updateModelMetaDataDto.singularName
      },
      relations: ["fields", "module"], //FIXME: Check with jenender and change to relations to avoid confusion
    });

    if (!existingModel) {
      throw new Error(ERROR_MESSAGES.MODEL_NOT_FOUND(updateModelMetaDataDto.singularName));
    }

    const updatedModel = modelRepo.merge(existingModel, modelMetaDataWithoutFields);
    await modelRepo.save(updatedModel);

    const existingFields = existingModel.fields || [];
    const existingFieldIds = existingFields.map((field) => field.id);

    // 2. Synchronize fields
    // const userKeyFieldName = updateModelMetaDataDto.userKeyFieldUserKey;
    let userKeyField = null;

    const fieldsToSave: FieldMetadata[] = [];
    const fieldsToDelete: FieldMetadata[] = [];

    for (const fieldMetadata of fieldsMetadata) {
      if (fieldMetadata.id) {
        // Existing field
        const existingField = existingFields.find((field) => field.id === fieldMetadata.id);
        if (existingField) {
          if (fieldMetadata.mediaStorageProviderId) {
            fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOne(fieldMetadata.mediaStorageProviderId);
          }
          Object.assign(existingField, fieldMetadata);
          fieldsToSave.push(existingField);
        }
      } else {
        // New field
        fieldMetadata['model'] = updatedModel;

        if (fieldMetadata.mediaStorageProviderId) {
          fieldMetadata['mediaStorageProvider'] = await this.mediaStorageProviderMetadataService.findOne(fieldMetadata.mediaStorageProviderId);
        }
        const createdField = fieldRepo.create(fieldMetadata);
        fieldsToSave.push(createdField);
      }

      // Check for userKeyField
      // if (fieldMetadata.isUserKey) {
      //   userKeyField = fieldMetadata;
      // }
    }

    // Fields to delete (not in the payload)
    fieldsToDelete.push(...existingFields.filter((field) => !fieldsMetadata.some((f) => f.id === field.id)));

    // Save and remove fields
    if (fieldsToSave.length > 0) {
      await fieldRepo.save(fieldsToSave);
    }
    if (fieldsToDelete.length > 0) {
      fieldsToDelete.forEach(field => { field.isMarkedForRemoval = true })
      await fieldRepo.save(fieldsToDelete);

      // await this.fieldMetadataRepo.remove(fieldsToDelete);
    }

    const finalModel = await modelRepo.findOne({
      where: { id: updatedModel.id },
      relations: ["fields", "userKeyField"]
    });

    // 3. Update model with userKeyField if specified
    const userKeyFields = fieldsMetadata.filter(field => field.isUserKey);

    if (userKeyFields.length > 0) {
      const newUserKeyField = userKeyFields[userKeyFields.length - 1];
      const savedUserKeyField = await fieldRepo.findOne({ where: { id: newUserKeyField.id } });

      if (savedUserKeyField) {
        finalModel.userKeyField = savedUserKeyField;
        await modelRepo.save(finalModel);
      }

      const otherUserKeyFields = userKeyFields.filter(field => field.id !== newUserKeyField.id);

      for (const field of otherUserKeyFields) {
        const existingField = await fieldRepo.findOne({ where: { id: field.id } });
        if (existingField) {
          existingField.isUserKey = false;
          await fieldRepo.save(existingField);
        }
      }
    } else {
      if (finalModel.userKeyField) {
        finalModel.userKeyField = null;
        await modelRepo.save(finalModel);
      }
    }

    return updatedModel;

  }

  async updateInFile(modelId: any, repo: Repository<ModelMetadata>) {
    try {

      const model = await repo.findOne({
        where: {
          id: modelId,
        },
        relations: ["fields", "fields.mediaStorageProvider", "module", "parentModel"], //FIXME: Check with jenender and change to relations to avoid confusion
        order: {
          fields: {
            id: "ASC",
          },
        },
      });

      const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module.name);
      const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

      const modelMetaData = {
        singularName: model.singularName,
        pluralName: model.pluralName,
        displayName: model.displayName,
        description: model.description,
        dataSource: model.dataSource,
        dataSourceType: model.dataSourceType,
        tableName: model.tableName,
        userKeyFieldUserKey: model.fields.find(field => field.isUserKey)?.name,
        isChild: model?.isChild,
        parentModelUserKey: model?.parentModel?.singularName,
        enableAuditTracking: model?.enableAuditTracking,
        enableSoftDelete: model?.enableSoftDelete,
        draftPublishWorkflow: model?.draftPublishWorkflow,
        internationalisation: model?.internationalisation,
        fields: []
      }

      for (let i = 0; i < model.fields.length; i++) {
        const field = model.fields[i];
        if (!field.isSystem) {

          const fieldObject: Record<string, any> = await this.fieldMetadataService.createFieldConfig(field);
          if (field.isMarkedForRemoval) {
            fieldObject.isMarkedForRemoval = true;
          }
          modelMetaData.fields.push(fieldObject);
        }
      }

      // Check if the model already exists in `models`
      const existingModelIndex = metaData.moduleMetadata.models.findIndex(
        (existingModel: any) => existingModel.singularName === modelMetaData.singularName
      );

      if (existingModelIndex !== -1) {
        // Update the existing model
        metaData.moduleMetadata.models[existingModelIndex] = modelMetaData;
      } else {
        // Add the new model
        metaData.moduleMetadata.models.push(modelMetaData);
      }

      // Write the updated object back to the file
      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);

    } catch (error: any) {
      // console.error('File creation failed:', error);
      this.logger.error('File creation failed:', error);
      throw new Error(ERROR_MESSAGES.FILE_WRITE_FAILED); // Trigger rollback
    }
  }

  async upsert(updateDto: UpdateModelMetaDataDto) {
    // First check if module already exists using name
    const existingModelMetadata = await this.modelMetadataRepo.findOne({
      where: {
        singularName: updateDto.singularName
      }
    })

    // if found
    if (existingModelMetadata) {
      const hasChanges = Object.entries(updateDto).some(([key, value]) => {
        if (key === 'module' || key === 'parentModel' || key === 'userKeyField') {
          return existingModelMetadata[key]?.id !== value?.id;
        }
        if (key === 'fields') {
          return JSON.stringify(existingModelMetadata.fields ?? null) !== JSON.stringify(value ?? null);
        }
        const currentValue = existingModelMetadata[key];
        if (Array.isArray(currentValue) || Array.isArray(value)) {
          return JSON.stringify(currentValue ?? null) !== JSON.stringify(value ?? null);
        }
        if (value && typeof value === 'object') {
          return JSON.stringify(currentValue ?? null) !== JSON.stringify(value ?? null);
        }
        return currentValue !== value;
      });

      if (!hasChanges) {
        return existingModelMetadata;
      }

      const updatedModelMetadata = { ...existingModelMetadata, ...updateDto };
      const updatedModel = await this.modelMetadataRepo.save(updatedModelMetadata);
      return updatedModel
    }
    // if not found - create new 
    else {
      const modelMetadata = this.modelMetadataRepo.create(updateDto);
      return this.modelMetadataRepo.save(modelMetadata);
    }
  }

  async previewDelete(id: number) {
    const model = await this.modelMetadataRepo.findOne({ where: { id }, relations: ['module', 'fields'] });
    if (!model) throw new NotFoundException(ERROR_MESSAGES.ENTITY_NOT_FOUND(`#${id}`));
    const plan = await this.buildDeletePlan(model);
    const planHash = createHash('sha256').update(JSON.stringify(plan.fingerprint)).digest('hex');
    return { model: { id: model.id, singularName: model.singularName, displayName: model.displayName }, planHash, changes: plan.changes };
  }

  @DisallowInProduction()
  async applyDelete(id: number, expectedPlanHash: string) {
    if (!expectedPlanHash) throw new BadRequestException('A confirmed delete preview is required.');
    const model = await this.modelMetadataRepo.findOne({ where: { id }, relations: ['module', 'fields'] });
    if (!model) throw new NotFoundException(ERROR_MESSAGES.ENTITY_NOT_FOUND(`#${id}`));
    const currentPlan = await this.buildDeletePlan(model);
    const currentHash = createHash('sha256').update(JSON.stringify(currentPlan.fingerprint)).digest('hex');
    if (currentHash !== expectedPlanHash) {
      throw new BadRequestException({ message: 'The delete inventory changed. Review the refreshed preview before applying.', preview: { model: { id: model.id, singularName: model.singularName, displayName: model.displayName }, planHash: currentHash, changes: currentPlan.changes } });
    }
    await this.cleanupOnDelete(model.id);
    return this.modelMetadataRepo.remove(model);
  }

  private async buildDeletePlan(model: ModelMetadata) {
    const viewRepo = this.dataSource.getRepository(ViewMetadata);
    const views = await viewRepo.find({ where: { model: { id: model.id } } });
    const viewIds = views.map(view => view.id);
    const userViews = viewIds.length ? await this.dataSource.getRepository(UserViewMetadata).find({ where: { viewMetadata: { id: In(viewIds) } }, relations: ['user', 'viewMetadata'] }) : [];
    const actionRepo = this.dataSource.getRepository(ActionMetadata);
    const actions = await actionRepo.find({ where: [{ model: { id: model.id } }, ...(viewIds.length ? [{ view: { id: In(viewIds) } }] : [])] });
    const actionIds = actions.map(action => action.id);
    const menus = await this.findMenusForActionIds(actionIds);
    const transactionRepo = this.dataSource.getRepository(ImportTransaction);
    const transactions = await transactionRepo.find({ where: { modelMetadata: { id: model.id } } });
    const importErrorLogs = transactions.length ? await this.dataSource.getRepository(ImportTransactionErrorLog).find({ where: { importTransaction: { id: In(transactions.map(row => row.id)) } }, select: ['id'] }) : [];
    const errorLogs = importErrorLogs.length;
    const permissions = await this.dataSource.getRepository(PermissionMetadata).createQueryBuilder('permission').leftJoinAndSelect('permission.roles', 'role').where('permission.name LIKE :pattern', { pattern: `${classify(model.singularName)}Controller.%` }).getMany();
    const securityRules = await this.dataSource.getRepository(SecurityRule).find({ where: { modelMetadata: { id: model.id } }, relations: ['role'] });
    const savedFilters = await this.dataSource.getRepository(SavedFilters).find({ where: [{ model: { id: model.id } }, ...(viewIds.length ? [{ view: { id: In(viewIds) } }] : [])] });
    const relatedFields = await this.dataSource.getRepository(FieldMetadata).find({ where: { relationCoModelSingularName: model.singularName }, relations: ['model', 'model.module'] });
    const childModels = await this.modelMetadataRepo.find({ where: { parentModel: { id: model.id } } });
    const metadataPath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module?.name);
    const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(metadataPath);
    const root = metadata?.moduleMetadata ?? metadata;
    const sections = metadata && ['views', 'actions', 'menus', 'dashboards', 'securityRules', 'savedFilters', 'permissions', 'roles'].some(key => Array.isArray(metadata[key])) ? metadata : root;
    const dashboardNames = (sections?.dashboards ?? []).filter((entry: any) => this.metadataReferencesModel(entry, model.singularName)).map((entry: any) => entry.name).filter(Boolean);
    const layouts = dashboardNames.length && model.module?.id
      ? await this.dataSource.getRepository(DashboardUserLayout).find({ where: { module: { id: model.module.id }, dashboardName: In(dashboardNames) }, relations: ['user'] })
      : [];
    const modulePath = await this.moduleMetadataHelperService.getModulePath(model.module?.name);
    const generatedFiles = modulePath ? [
      `${modulePath}/entities/${kebabCase(model.singularName)}.entity.ts`,
      `${modulePath}/dtos/create-${kebabCase(model.singularName)}.dto.ts`,
      `${modulePath}/dtos/update-${kebabCase(model.singularName)}.dto.ts`,
      `${modulePath}/repositories/${kebabCase(model.singularName)}.repository.ts`,
      `${modulePath}/services/${kebabCase(model.singularName)}.service.ts`,
      `${modulePath}/controllers/${kebabCase(model.singularName)}.controller.ts`,
    ].filter(file => existsSync(file)) : [];
    const relatedSourceFiles: string[] = [];
    const relatedMetadataFiles: string[] = [];
    const apiRoot = this.resolveSolidApiRoot();
    const modelKebab = kebabCase(model.singularName);
    if (apiRoot) {
      const scan = async (directory: string): Promise<void> => {
        const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (!['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) await scan(path.join(directory, entry.name));
          } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
            const file = path.join(directory, entry.name);
            const content = await fs.readFile(file, 'utf8').catch(() => '');
            if (content.includes(`/${modelKebab}.entity`) || content.includes(`/create-${modelKebab}.dto`) || content.includes(`/update-${modelKebab}.dto`)) relatedSourceFiles.push(file);
          } else if (entry.isFile() && /-metadata\.json$/.test(entry.name)) {
            const file = path.join(directory, entry.name);
            const content = await fs.readFile(file, 'utf8').catch(() => '');
            try {
              const parsed = JSON.parse(content);
              const relatedNames = [...views, ...actions, ...menus].map(item => item.name).filter(Boolean);
              if (this.metadataReferencesModel(parsed, model.singularName) || content.includes(`${classify(model.singularName)}Controller.`) || relatedNames.some(name => content.includes(`"${name}"`))) relatedMetadataFiles.push(file);
            } catch {
              // Invalid metadata is omitted from the preview and will be logged by the cleanup helper.
            }
          }
        }
      };
      await scan(path.join(apiRoot, 'src'));
    }
    for (const field of relatedFields) {
      if (!field.model) continue;
      const ownerModulePath = await this.moduleMetadataHelperService.getModulePath(field.model.module?.name);
      const ownerKebab = kebabCase(field.model.singularName);
      for (const file of [path.join(ownerModulePath, 'entities', `${ownerKebab}.entity.ts`), path.join(ownerModulePath, 'dtos', `create-${ownerKebab}.dto.ts`), path.join(ownerModulePath, 'dtos', `update-${ownerKebab}.dto.ts`)]) {
        if (existsSync(file) && !relatedSourceFiles.includes(file)) relatedSourceFiles.push(file);
      }
    }
    const changes = [
      { category: 'Generated code', description: 'Delete generated model entity, DTO, repository, service, and controller files.', count: generatedFiles.length, items: generatedFiles },
      { category: 'Metadata database', description: 'Delete model and cascading field metadata.', count: 1 + (model.fields?.length ?? 0), items: [`${model.singularName} (${model.fields?.length ?? 0} fields)`] },
      { category: 'Views, actions, menus', description: 'Delete associated user views, views, actions, and menus including role links.', count: views.length + userViews.length + actions.length + menus.length, items: [...views.map(v => `view: ${v.name}`), ...userViews.map(v => `user view: ${v.viewMetadata?.name ?? v.id} (user ${v.user?.id ?? 'unknown'})`), ...actions.map(a => `action: ${a.name}`), ...menus.map(m => `menu: ${m.name} (roles: ${(m.roles ?? []).map(role => role.name).join(', ') || 'none'})`)] },
      { category: 'Imports', description: 'Delete import transactions and their error logs.', count: transactions.length + errorLogs, items: [`${transactions.length} transactions`, `${errorLogs} error logs`] },
      { category: 'Permissions and security', description: 'Delete model permissions and their role links, plus model security rules.', count: permissions.length + securityRules.length, items: [...permissions.map(p => `permission: ${p.name} (roles: ${(p.roles ?? []).map(role => role.name).join(', ') || 'none'})`), ...securityRules.map(r => `security rule: ${r.name} (role: ${r.role?.name ?? 'unknown'})`)] },
      { category: 'Saved filters', description: 'Delete filters scoped to this model or its views.', count: savedFilters.length, items: savedFilters.map(f => f.name) },
      { category: 'Dashboards', description: 'Delete model-referencing dashboard definitions and saved user layouts.', count: dashboardNames.length + layouts.length, items: [...dashboardNames.map(name => `dashboard: ${name}`), ...layouts.map(layout => `layout: ${layout.dashboardName} (user ${layout.user?.id ?? 'unknown'})`)] },
      { category: 'TypeScript references', description: 'Remove generated registrations and model references in app/database modules, DTOs, and related entity properties.', count: relatedSourceFiles.length, items: relatedSourceFiles },
      { category: 'Related model metadata', description: 'Remove relation fields and parent-model links that point at this model.', count: relatedFields.length + childModels.length + relatedMetadataFiles.length, items: [...relatedFields.map(field => `${field.model?.singularName ?? 'model'}.${field.name}`), ...childModels.map(child => `${child.singularName}.parentModel`), ...relatedMetadataFiles] },
      { category: 'Manual follow-up', description: 'Drop the model data table manually after reviewing its relations. This API will not drop the table.', count: 1, items: [`${model.tableName ?? model.singularName} database table`] },
    ];
    const fileFingerprints = await Promise.all(relatedSourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')]));
    const metadataFileFingerprints = await Promise.all(relatedMetadataFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')]));
    const fingerprint = { modelId: model.id, modelName: model.singularName, fieldIds: model.fields?.map(field => field.id), metadataPath, metadataContent: metadata ? JSON.stringify(metadata) : null, views: views.map(v => ({ id: v.id, name: v.name })), userViews: userViews.map(v => ({ id: v.id, userId: v.user?.id, viewId: v.viewMetadata?.id })), actions: actions.map(a => ({ id: a.id, name: a.name })), menus: menus.map(m => ({ id: m.id, name: m.name, roleIds: (m.roles ?? []).map(role => role.id).sort() })), transactions: transactions.map(t => t.id), errorLogs: importErrorLogs.map(log => log.id), permissions: permissions.map(p => ({ id: p.id, name: p.name, roleIds: (p.roles ?? []).map(role => role.id).sort() })), securityRules: securityRules.map(r => ({ id: r.id, name: r.name, roleId: r.role?.id })), savedFilters: savedFilters.map(f => ({ id: f.id, name: f.name })), dashboards: dashboardNames, layouts: layouts.map(l => ({ id: l.id, dashboardName: l.dashboardName })), relatedFields: relatedFields.map(field => ({ id: field.id, name: field.name, modelId: field.model?.id })), childModels: childModels.map(child => ({ id: child.id, name: child.singularName })), files: generatedFiles, relatedSourceFiles: fileFingerprints, relatedMetadataFiles: metadataFileFingerprints };
    return { changes, fingerprint };
  }

  private metadataReferencesModel(value: any, singularName: string): boolean {
    if (Array.isArray(value)) return value.some(item => this.metadataReferencesModel(item, singularName));
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) =>
      (['modelUserKey', 'modelMetadataUserKey', 'model', 'modelName', 'entityName', 'singularName', 'relationCoModelSingularName', 'parentModelUserKey'].includes(key) && child === singularName) || this.metadataReferencesModel(child, singularName));
  }

  private async cleanupOtherModuleMetadataFiles(
    currentFile: string,
    model: ModelMetadata,
    removedActionNames: Set<string>,
    removedMenuNames: Set<string>,
    removedViewNames: Set<string>,
  ) {
    const apiRoot = this.resolveSolidApiRoot();
    if (!apiRoot) return;
    const metadataFiles: string[] = [];
    const scan = async (directory: string): Promise<void> => {
      const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) await scan(path.join(directory, entry.name));
        } else if (entry.isFile() && /-metadata\.json$/.test(entry.name)) metadataFiles.push(path.join(directory, entry.name));
      }
    };
    await scan(path.join(apiRoot, 'src'));
    for (const file of metadataFiles) {
      if (path.resolve(file) === path.resolve(currentFile)) continue;
      const metadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(file);
      if (!metadata) continue;
      const moduleMetadata = metadata?.moduleMetadata ?? metadata;
      const sections = ['views', 'actions', 'menus', 'dashboards', 'securityRules', 'savedFilters', 'permissions', 'roles'].some(key => Array.isArray(metadata[key])) ? metadata : moduleMetadata;
      const before = JSON.stringify(metadata);
      if (Array.isArray(moduleMetadata?.models)) {
        moduleMetadata.models = moduleMetadata.models.filter((entry: any) => entry?.singularName !== model.singularName);
        for (const entry of moduleMetadata.models) {
          if (entry?.parentModelUserKey === model.singularName) entry.parentModelUserKey = null;
          if (entry?.parentModel === model.singularName) entry.parentModel = null;
          if (Array.isArray(entry?.fields)) entry.fields = entry.fields.filter((field: any) => field?.relationCoModelSingularName !== model.singularName);
        }
      }
      const views = Array.isArray(sections?.views) ? sections.views : null;
      if (views) sections.views = views.filter((view: any) => view?.modelUserKey !== model.singularName && !removedViewNames.has(view?.name));
      const actions = Array.isArray(sections?.actions) ? sections.actions : null;
      if (actions) sections.actions = actions.filter((action: any) => action?.modelUserKey !== model.singularName && !removedActionNames.has(action?.name) && !removedViewNames.has(action?.viewUserKey));
      let menus = Array.isArray(sections?.menus) ? [...sections.menus] : null;
      let changed = true;
      while (menus && changed) {
        changed = false;
        menus = menus.filter((menu: any) => {
          const remove = menu?.modelUserKey === model.singularName || removedMenuNames.has(menu?.name) || removedActionNames.has(menu?.actionUserKey) || removedMenuNames.has(menu?.parentMenuItemUserKey);
          if (remove) { changed = true; return false; }
          return true;
        });
      }
      if (menus) sections.menus = menus;
      if (Array.isArray(sections?.dashboards)) sections.dashboards = sections.dashboards.filter((dashboard: any) => !this.metadataReferencesModel(dashboard, model.singularName));
      if (Array.isArray(sections?.securityRules)) sections.securityRules = sections.securityRules.filter((rule: any) => rule?.modelMetadataUserKey !== model.singularName && rule?.modelUserKey !== model.singularName);
      if (Array.isArray(sections?.savedFilters)) sections.savedFilters = sections.savedFilters.filter((filter: any) => filter?.modelUserKey !== model.singularName && !removedViewNames.has(filter?.viewUserKey));
      const prefix = `${classify(model.singularName)}Controller.`;
      if (Array.isArray(sections?.permissions)) sections.permissions = sections.permissions.filter((permission: any) => typeof permission !== 'string' ? typeof permission?.name !== 'string' || !permission.name.startsWith(prefix) : !permission.startsWith(prefix));
      if (Array.isArray(sections.roles)) sections.roles = sections.roles.map((role: any) => Array.isArray(role?.permissions) ? { ...role, permissions: role.permissions.filter((permission: string) => !permission.startsWith(prefix)) } : role);
      if (JSON.stringify(metadata) !== before) await fs.writeFile(file, JSON.stringify(metadata, null, 2));
    }
  }

  async cleanupOnDelete(modelEntityId: number) {
    const modelEntity = await this.modelMetadataRepo.findOne({
      where: {
        // @ts-ignore
        id: modelEntityId,
      },
      relations: ['module', 'fields']
    });

    if (!modelEntity) {
      this.logger.log(`Invalid modelEntityId: ${modelEntityId} unable to resolve model metadata`);
      return;
    }
    if (modelEntity.id !== modelEntityId) {
      this.logger.log(`Invalid modelEntityId: ${modelEntityId} unable to resolve model metadata id ${modelEntity.id} not matching with the one passed as argument ${modelEntityId}`);
      return;
    }

    this.logger.log(`Cleaning up for model: ${modelEntity.singularName} belonging to module: ${modelEntity.module?.name}`);

    const modulePath = await this.moduleMetadataHelperService.getModulePath(modelEntity.module?.name);
    if (modulePath) {
      // /Users/harishpatel/Code/javascript/school-fees-portal/solid-api/src/solid-core
      this.logger.log(`Module path: ${modulePath}`);

      const filesToDelete = [];
      // <singularName>.entity.ts | The TypeORM model that needs to be deleted. | Automatic
      const entityFilePath = `${modulePath}/entities/${kebabCase(modelEntity.singularName)}.entity.ts`;
      filesToDelete.push(entityFilePath);
      this.logger.log(`About to delete entity file path: ${entityFilePath}`);

      // <singularName>.create.dto.ts | The TypeORM model that needs to be deleted. | Automatic
      const createDtoFilePath = `${modulePath}/dtos/create-${kebabCase(modelEntity.singularName)}.dto.ts`;
      filesToDelete.push(createDtoFilePath);
      this.logger.log(`About to delete create DTO file path: ${createDtoFilePath}`);

      // <singularName>.update.dto.ts | The TypeORM model that needs to be deleted. | Automatic
      const updateDtoFilePath = `${modulePath}/dtos/update-${kebabCase(modelEntity.singularName)}.dto.ts`;
      filesToDelete.push(updateDtoFilePath);
      this.logger.log(`About to delete update DTO file path: ${updateDtoFilePath}`);

      // <singularName>.repository.ts | The TypeORM model that needs to be deleted. | Automatic
      const repositoryFilePath = `${modulePath}/repositories/${kebabCase(modelEntity.singularName)}.repository.ts`;
      filesToDelete.push(repositoryFilePath);
      this.logger.log(`About to delete repository file path: ${repositoryFilePath}`);

      // <singularName>.service.ts | The TypeORM model that needs to be deleted. | Automatic
      const serviceFilePath = `${modulePath}/services/${kebabCase(modelEntity.singularName)}.service.ts`;
      filesToDelete.push(serviceFilePath);
      this.logger.log(`About to delete service file path: ${serviceFilePath}`);

      // <singularName>.controller.ts | The TypeORM model that needs to be deleted. | Automatic
      const controllerFilePath = `${modulePath}/controllers/${kebabCase(modelEntity.singularName)}.controller.ts`;
      filesToDelete.push(controllerFilePath);
      this.logger.log(`About to delete controller file path: ${controllerFilePath}`);

      for (let i = 0; i < filesToDelete.length; i++) {
        const fileToDelete = filesToDelete[i];
        try {
          await fs.unlink(fileToDelete);
          this.logger.log(`Deleted file: ${fileToDelete}`);
        } catch (error: any) {
          if (error?.code === 'ENOENT') {
            this.logger.warn(`File already absent, skipping delete: ${fileToDelete}`);
            continue;
          }
          this.logger.error(`Error deleting file: ${fileToDelete}`, error);
        }
      }
    }

    const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(modelEntity.module?.name);
    const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
    const rootMetadata = metaData?.moduleMetadata ?? metaData;
    const metadataSections = metaData && ['views', 'actions', 'menus', 'dashboards', 'securityRules', 'savedFilters', 'permissions', 'roles'].some(key => Array.isArray(metaData[key])) ? metaData : rootMetadata;
    const dashboardsForModel = (metadataSections?.dashboards ?? []).filter((item: any) => this.metadataReferencesModel(item, modelEntity.singularName));
    const removedDashboardNames = new Set<string>(dashboardsForModel.map((item: any) => item?.name).filter(Boolean));
    const existingViewIds = (await this.dataSource.getRepository(ViewMetadata).find({ where: { model: { id: modelEntity.id } }, select: ['id'] })).map(view => view.id);
    const removedRelatedFields = await this.cleanupAssociatedModelScopedRecords(modelEntity, removedDashboardNames, existingViewIds);

    const { removedActionNames, removedMenuNames, removedViewNames } = await this.cleanupAssociatedViewsActionsAndMenus(modelEntity.id);
    await this.cleanupAssociatedImports(modelEntity.id);
    await this.cleanupAssociatedPermissions(modelEntity.singularName);
    await this.clearModelReferencesBeforeDelete(modelEntity);

    // <moduleName>-metadata.json | Remove references to this model in model, menu, action, view and related sections.
    const removedActionNameSet = new Set(removedActionNames);
    const removedMenuNameSet = new Set(removedMenuNames);
    const removedViewNameSet = new Set(removedViewNames);
    if (metaData) {
      const moduleMetadata = metaData?.moduleMetadata ?? metaData;
      const vamMetadata = metadataSections;

      const existingModels = Array.isArray(moduleMetadata?.models) ? moduleMetadata.models : [];
      const existingModelIndex = existingModels.findIndex(
        (existingModel: any) => existingModel.singularName === modelEntity.singularName
      );

      // Remove the model to be deleted from the metadata
      if (existingModelIndex !== -1) {
        existingModels.splice(existingModelIndex, 1);
      }
      for (const existingModel of existingModels) {
        if (existingModel?.parentModelUserKey === modelEntity.singularName) existingModel.parentModelUserKey = null;
        if (existingModel?.parentModel === modelEntity.singularName) existingModel.parentModel = null;
        if (Array.isArray(existingModel?.fields)) {
          existingModel.fields = existingModel.fields.filter((field: any) => field?.relationCoModelSingularName !== modelEntity.singularName);
        }
      }

      // Remove references to this model in the menu, action & view sections.
      const existingViews = Array.isArray(vamMetadata?.views) ? vamMetadata.views : [];
      vamMetadata.views = existingViews.filter((view: any) => {
        const shouldRemove = view?.modelUserKey === modelEntity.singularName || removedViewNameSet.has(view?.name);
        if (shouldRemove && view?.name) {
          removedViewNameSet.add(view.name);
        }
        return !shouldRemove;
      });

      const existingActions = Array.isArray(vamMetadata?.actions) ? vamMetadata.actions : [];
      vamMetadata.actions = existingActions.filter((action: any) => {
        const shouldRemove =
          action?.modelUserKey === modelEntity.singularName ||
          removedActionNameSet.has(action?.name) ||
          removedViewNameSet.has(action?.viewUserKey);

        if (shouldRemove && action?.name) {
          removedActionNameSet.add(action.name);
        }
        return !shouldRemove;
      });

      let pendingMenus = Array.isArray(vamMetadata?.menus) ? [...vamMetadata.menus] : [];
      let menuRemovedOnPass = true;
      while (menuRemovedOnPass) {
        menuRemovedOnPass = false;
        pendingMenus = pendingMenus.filter((menu: any) => {
          const shouldRemove =
            menu?.modelUserKey === modelEntity.singularName ||
            removedMenuNameSet.has(menu?.name) ||
            removedActionNameSet.has(menu?.actionUserKey) ||
            removedMenuNameSet.has(menu?.parentMenuItemUserKey);

          if (shouldRemove) {
            if (menu?.name) {
              removedMenuNameSet.add(menu.name);
            }
            menuRemovedOnPass = true;
            return false;
          }

          return true;
        });
      }
      vamMetadata.menus = pendingMenus;

      // These metadata sections are module-scoped, so remove only entries that reference this model.
      const dashboards = Array.isArray(vamMetadata?.dashboards) ? vamMetadata.dashboards : [];
      vamMetadata.dashboards = dashboards.filter((item: any) => !this.metadataReferencesModel(item, modelEntity.singularName));
      vamMetadata.securityRules = (Array.isArray(vamMetadata?.securityRules) ? vamMetadata.securityRules : []).filter((item: any) => item?.modelMetadataUserKey !== modelEntity.singularName && item?.modelUserKey !== modelEntity.singularName);
      vamMetadata.savedFilters = (Array.isArray(vamMetadata?.savedFilters) ? vamMetadata.savedFilters : []).filter((item: any) => item?.modelUserKey !== modelEntity.singularName && !removedViewNameSet.has(item?.viewUserKey));
      const controllerPrefix = `${classify(modelEntity.singularName)}Controller.`;
      vamMetadata.permissions = (Array.isArray(vamMetadata?.permissions) ? vamMetadata.permissions : []).filter((item: any) => typeof item !== 'string' ? typeof item?.name !== 'string' || !item.name.startsWith(controllerPrefix) : !item.startsWith(controllerPrefix));
      if (Array.isArray(vamMetadata.roles)) {
        vamMetadata.roles = vamMetadata.roles.map((role: any) => Array.isArray(role?.permissions) ? { ...role, permissions: role.permissions.filter((permission: string) => !permission.startsWith(controllerPrefix)) } : role);
      }

      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);
    }
    await this.cleanupOtherModuleMetadataFiles(filePath, modelEntity, removedActionNameSet, removedMenuNameSet, removedViewNameSet);

    // <moduleName>.module.ts | Remove all references and imports of the deleted model files. | Automatic
    if (modulePath) {
      const moduleFilePath = path.resolve(modulePath, `${kebabCase(modelEntity.module?.name)}.module.ts`);
      this.logger.log(`Removing model '${modelEntity.singularName}' references from module file: ${moduleFilePath}`);
      try {
        this.solidTsMorphService.begin();
        const modelPathSegment = `/${kebabCase(modelEntity.singularName)}.`;
        const { removedIdentifiers } = this.solidTsMorphService.removeImports(
          moduleFilePath,
          spec => spec.includes(modelPathSegment)
        );
        this.solidTsMorphService.removeModuleMembers(moduleFilePath, removedIdentifiers);
        await this.solidTsMorphService.commit();
      } catch (error: any) {
        this.solidTsMorphService.rollback();
        this.logger.error(`Failed to clean up module file for model '${modelEntity.singularName}':`, error);
      }
    }

    await this.cleanupAssociatedTypeormDatasourceFiles(modelEntity, modulePath, removedRelatedFields);

    // - | Drop database table | Removes the database table from the DB, this is a very risky step. Best to review all relations to other models etc and then do this manually | Manual (X)

  }

  private async cleanupAssociatedModelScopedRecords(model: ModelMetadata, dashboardNames: Set<string>, viewIds: number[]) {
    const relatedFields = await this.dataSource.getRepository(FieldMetadata).find({ where: { relationCoModelSingularName: model.singularName }, relations: ['model', 'model.module'] });
    if (relatedFields.length) await this.dataSource.getRepository(FieldMetadata).remove(relatedFields);

    const savedFilterRepo = this.dataSource.getRepository(SavedFilters);
    const savedFilters = await savedFilterRepo.find({ where: [{ model: { id: model.id } }, ...(viewIds.length ? [{ view: { id: In(viewIds) } }] : [])] });
    if (savedFilters.length) await savedFilterRepo.remove(savedFilters);

    const securityRuleRepo = this.dataSource.getRepository(SecurityRule);
    const securityRules = await securityRuleRepo.find({ where: { modelMetadata: { id: model.id } } });
    if (securityRules.length) await securityRuleRepo.remove(securityRules);

    if (dashboardNames.size && model.module?.id) {
      const layoutRepo = this.dataSource.getRepository(DashboardUserLayout);
      const layouts = await layoutRepo.find({ where: { module: { id: model.module.id }, dashboardName: In([...dashboardNames]) } });
      if (layouts.length) await layoutRepo.remove(layouts);
    }
    return relatedFields;
  }

  private resolveSolidApiRoot(): string | null {
    const cwd = process.cwd();
    const candidates = [
      cwd,
      path.join(cwd, 'solid-api'),
    ];

    for (const candidate of candidates) {
      const srcRoot = path.join(candidate, 'src');
      if (existsSync(srcRoot)) {
        return candidate;
      }
    }

    return null;
  }

  private async cleanupAssociatedTypeormDatasourceFiles(modelEntity: ModelMetadata, modulePath?: string | null, relatedFields: FieldMetadata[] = []) {
    const solidApiRoot = this.resolveSolidApiRoot();
    if (!solidApiRoot) {
      this.logger.warn(`Unable to locate consuming solid-api workspace while cleaning datasource files for model '${modelEntity.singularName}'`);
      return;
    }

    const srcRoot = path.join(solidApiRoot, 'src');
    const candidateFiles: string[] = [];
    const scan = async (directory: string): Promise<void> => {
      const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) await scan(path.join(directory, entry.name));
        } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) candidateFiles.push(path.join(directory, entry.name));
      }
    };
    await scan(srcRoot);
    if (candidateFiles.length === 0) {
      return;
    }

    const moduleDirName = modulePath ? path.basename(modulePath) : kebabCase(modelEntity.module?.name ?? '');
    const entityClassName = classify(modelEntity.singularName);
    const entityImportPath = `./${moduleDirName}/entities/${kebabCase(modelEntity.singularName)}.entity`;

    this.logger.log(`Scanning ${candidateFiles.length} TypeScript file(s) for model '${modelEntity.singularName}' references`);

    try {
      this.solidTsMorphService.begin();
      for (const datasourceFile of candidateFiles) {
        this.solidTsMorphService.removeDeletedModelReferences(
          datasourceFile,
          [`/${kebabCase(modelEntity.singularName)}.entity`, `/create-${kebabCase(modelEntity.singularName)}.dto`, `/update-${kebabCase(modelEntity.singularName)}.dto`],
          [classify(modelEntity.singularName), `${classify(modelEntity.singularName)}CreateDto`, `${classify(modelEntity.singularName)}UpdateDto`],
        );
        this.solidTsMorphService.cleanupTypeormDatasourceEntity(datasourceFile, entityImportPath, entityClassName);
      }
      const relatedModels = new Map<number, ModelMetadata>();
      for (const field of relatedFields) if (field.model) relatedModels.set(field.model.id, field.model);
      for (const relatedModel of relatedModels.values()) {
        const relatedModulePath = await this.moduleMetadataHelperService.getModulePath(relatedModel.module?.name);
        if (!relatedModulePath) continue;
        const relatedModelName = kebabCase(relatedModel.singularName);
        const affectedFiles = [
          path.join(relatedModulePath, 'entities', `${relatedModelName}.entity.ts`),
          path.join(relatedModulePath, 'dtos', `create-${relatedModelName}.dto.ts`),
          path.join(relatedModulePath, 'dtos', `update-${relatedModelName}.dto.ts`),
        ];
        const fieldNames = relatedFields.filter(field => field.model?.id === relatedModel.id).map(field => field.name);
        for (const file of affectedFiles) this.solidTsMorphService.removePropertiesByName(file, fieldNames);
      }
      await this.solidTsMorphService.commit();
    } catch (error: any) {
      this.solidTsMorphService.rollback();
      this.logger.error(`Failed to clean datasource files for model '${modelEntity.singularName}':`, error);
    }
  }

  private async cleanupAssociatedViewsActionsAndMenus(modelId: number) {
    const viewRepo = this.dataSource.getRepository(ViewMetadata);
    const actionRepo = this.dataSource.getRepository(ActionMetadata);
    const menuRepo = this.dataSource.getRepository(MenuItemMetadata);
    const userViewRepo = this.dataSource.getRepository(UserViewMetadata);

    const views = await viewRepo.find({
      where: {
        model: { id: modelId },
      },
    });
    const viewIds = views.map((view) => view.id);
    const removedViewNames = views.map((view) => view.name).filter(Boolean);

    const actions = await actionRepo.find({
      where: [
        {
          model: { id: modelId },
        },
        ...(viewIds.length > 0
          ? [
            {
              view: { id: In(viewIds) },
            },
          ]
          : []),
      ],
      relations: ['view'],
    });

    const uniqueActions = Array.from(
      new Map(actions.map((action) => [action.id, action])).values(),
    );
    const actionIds = uniqueActions.map((action) => action.id);
    const removedActionNames = uniqueActions.map((action) => action.name).filter(Boolean);

    const menus = await this.findMenusForActionIds(actionIds);
    const removedMenuNames = menus.map((menu) => menu.name).filter(Boolean);

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

      this.logger.log(`Deleted ${menus.length} menu metadata record(s) for model id ${modelId}`);
    }

    if (uniqueActions.length > 0) {
      await actionRepo.remove(uniqueActions);
      this.logger.log(`Deleted ${uniqueActions.length} action metadata record(s) for model id ${modelId}`);
    }

    if (viewIds.length > 0) {
      const userViews = await userViewRepo.find({
        where: {
          viewMetadata: { id: In(viewIds) },
        },
        relations: ['viewMetadata'],
      });
      if (userViews.length > 0) {
        await userViewRepo.remove(userViews);
        this.logger.log(`Deleted ${userViews.length} user view metadata record(s) for model id ${modelId}`);
      }

      await viewRepo.remove(views);
      this.logger.log(`Deleted ${views.length} view metadata record(s) for model id ${modelId}`);
    }

    return {
      removedActionNames,
      removedMenuNames,
      removedViewNames,
    };
  }

  private async cleanupAssociatedImports(modelId: number) {
    const importTransactionRepo = this.dataSource.getRepository(ImportTransaction);
    const importTransactionErrorLogRepo = this.dataSource.getRepository(ImportTransactionErrorLog);

    const importTransactions = await importTransactionRepo.find({
      where: {
        modelMetadata: { id: modelId },
      },
    });

    if (importTransactions.length === 0) {
      return;
    }

    const importTransactionIds = importTransactions.map((transaction) => transaction.id);
    const importTransactionErrorLogs = await importTransactionErrorLogRepo.find({
      where: {
        importTransaction: { id: In(importTransactionIds) },
      },
      relations: ['importTransaction'],
    });

    if (importTransactionErrorLogs.length > 0) {
      await importTransactionErrorLogRepo.remove(importTransactionErrorLogs);
      this.logger.log(`Deleted ${importTransactionErrorLogs.length} import transaction error log record(s) for model id ${modelId}`);
    }

    await importTransactionRepo.remove(importTransactions);
    this.logger.log(`Deleted ${importTransactions.length} import transaction record(s) for model id ${modelId}`);
  }

  private async cleanupAssociatedPermissions(modelSingularName: string) {
    const permissionsRepo = this.dataSource.getRepository(PermissionMetadata);
    const controllerName = `${classify(modelSingularName)}Controller`;
    const permissions = await permissionsRepo
      .createQueryBuilder('permission')
      .leftJoinAndSelect('permission.roles', 'role')
      .where('permission.name LIKE :pattern', { pattern: `${controllerName}.%` })
      .getMany();

    if (permissions.length === 0) {
      return;
    }

    for (const permission of permissions) {
      if (permission.roles?.length) {
        await this.dataSource
          .createQueryBuilder()
          .relation(PermissionMetadata, 'roles')
          .of(permission.id)
          .remove(permission.roles.map((role) => role.id));
      }
    }

    await permissionsRepo.remove(permissions);
    this.logger.log(`Deleted ${permissions.length} permission metadata record(s) for model '${modelSingularName}'`);
  }

  private async clearModelReferencesBeforeDelete(modelEntity: ModelMetadata) {
    const modelRepo = this.dataSource.getRepository(ModelMetadata);
    const fieldIds = (modelEntity.fields ?? []).map((field) => field.id).filter(Boolean);

    if (fieldIds.length > 0) {
      await modelRepo
        .createQueryBuilder()
        .update(ModelMetadata)
        .set({ userKeyField: null as any })
        .where('user_key_field_id IN (:...fieldIds)', { fieldIds })
        .execute();
    }

    await modelRepo
      .createQueryBuilder()
      .update(ModelMetadata)
      .set({ parentModel: null as any })
      .where('parent_model_id = :modelId', { modelId: modelEntity.id })
      .execute();
  }

  private async findMenusForActionIds(actionIds: number[]) {
    if (!actionIds?.length) {
      return [];
    }

    const menuRepo = this.dataSource.getRepository(MenuItemMetadata);
    const menusById = new Map<number, MenuItemMetadata>();

    const rootMenus = await menuRepo.find({
      where: {
        action: { id: In(actionIds) },
      },
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

  @DisallowInProduction()
  async generateCodeViaCtl(modelId: number): Promise<string> {
    const model = await this.findOne(modelId);
    return this.commandService.executeCommandWithArgs({
      command: 'npx',
      args: ['@solidxai/solidctl@latest', 'generate', 'model', `--name=${model.singularName}`],
      cwd: path.join(process.cwd(), '..'),
    });
  }

  @DisallowInProduction()
  async handleGenerateCode(options: CodeGenerationOptions): Promise<any> {
    const affectedModelIds = [], refreshModelCodeOutputLines = [], removeFieldCodeOutputLines = [];

    // Generate the code for the passed model
    const { model, removeFieldCodeOuput, refreshModelCodeOutput } = await this.generateCode(options);
    affectedModelIds.push(model.id);
    refreshModelCodeOutputLines.push(refreshModelCodeOutput);
    removeFieldCodeOutputLines.push(removeFieldCodeOuput);

    // Generate the code for models which are linked to fields having an inverse relation
    await this.generateCodeForInverseModels(model, options, affectedModelIds, refreshModelCodeOutputLines, removeFieldCodeOutputLines);

    // Generate the VAM config for all the affected models
    for (const modelId of affectedModelIds) {
      await this.generateVAMConfig(modelId);
    }

    // Return the aggregated code output
    return `${removeFieldCodeOutputLines.join('\n')} \n ${refreshModelCodeOutputLines.join('\n')}`;
  }

  private async generateCodeForInverseModels(model: ModelMetadata, options: CodeGenerationOptions, affectedModelIds: any[], refreshModelCodeOutputLines: any[], removeFieldCodeOutputLines: any[]) {
    const coModelSingularNames = model.fields.
      filter(field => field.type === SolidFieldType.relation && field.relationCreateInverse === true)
      .map(field => field.relationCoModelSingularName);

    for (const singularName of coModelSingularNames) {
      const coModel = await this.findOneBySingularName(singularName);
      const inverseOptions: CodeGenerationOptions = {
        modelId: coModel.id,
        dryRun: options.dryRun
      };
      const { removeFieldCodeOuput, refreshModelCodeOutput } = await this.generateCode(inverseOptions);
      affectedModelIds.push(coModel.id);
      refreshModelCodeOutputLines.push(refreshModelCodeOutput);
      removeFieldCodeOutputLines.push(removeFieldCodeOuput);
    }
  }

  // Generate the View, Action and Menu configuration for the model
  async generateVAMConfig(modelId: number) {
    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        const modelRepository = manager.getRepository(ModelMetadata);
        const model = await modelRepository.findOne({
          where: {
            id: modelId
          },
          relations: ["fields", "module"]
        });
        await this.populateVAMConfigInDb(model);
        await this.populateVAMConfigInFile(model);
      });
    } catch (error: any) {
      this.logger.error('generateVAMConfig Transaction failed:', error);
      throw error;
    }
  }

  private async populateVAMConfigInFile(model: ModelMetadata) {
    try {
      const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module.name);
      const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

      const listViewLayoutFields = [{ type: "field", attrs: { name: `id` } }];
      const treeViewLayoutFields = [{ type: "field", attrs: { name: `id` } }];
      const formViewLayoutFields = [];

      for (let i = 0; i < model.fields.length; i++) {
        const field = model.fields[i];
        if (field.isSystem) continue;
        listViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}` } })
        formViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}` } })
        treeViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}` } })
      }
      this.populateVAMConfigInFileInternal(formViewLayoutFields, model, listViewLayoutFields, treeViewLayoutFields, metaData);
      // Write the updated object back to the file
      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);

    } catch (error: any) {
      // console.error('File creation failed:', error);
      this.logger.error('File updation failed for View, action, menus config:', error);
      throw new Error('File updation failed for View, action, menus config'); // Trigger rollback
    }
  }

  // Populate the View, Actions and Menus in the config file
  private populateVAMConfigInFileInternal(formViewLayoutFields: any[], model: ModelMetadata, listViewLayoutFields: { type: string; attrs: { name: string; }; }[], treeViewLayoutFields: { type: string; attrs: { name: string; }; }[], metaData: any) {
    const column1Fields = [];
    // const column2Fields = [];

    // Distribute fields between two columns
    for (let i = 0; i < formViewLayoutFields.length; i++) {
      // if (i % 2 === 0) {
      column1Fields.push(formViewLayoutFields[i]);
      // } else {
      // column2Fields.push(formViewLayoutFields[i]);
      // }
    }
    const actionName = `${model.singularName}-list-action`;
    const treeViewActionName = `${model.singularName}-tree-action`;
    const listViewName = `${model.singularName}-list-view`;
    const treeViewName = `${model.singularName}-tree-view`;
    const formViewName = `${model.singularName}-form-view`;
    const menuName = `${model.singularName}-menu-item`;
    const nextMenuSequenceNumber = (metaData.menus?.length ?? 0) + 1;

    const action = {
      displayName: `${model.displayName} List Action`,
      name: actionName,
      type: "solid",
      domain: "",
      context: "",
      customComponent: ``,
      customIsModal: true,
      serverEndpoint: "",
      viewUserKey: listViewName,
      moduleUserKey: `${model.module.name}`,
      modelUserKey: `${model.singularName}`
    };

    const treeViewAction = {
      displayName: `${model.displayName} Tree View Action`,
      name: treeViewActionName,
      type: "solid",
      domain: "",
      context: "",
      customComponent: ``,
      customIsModal: true,
      serverEndpoint: "",
      viewUserKey: treeViewName,
      moduleUserKey: `${model.module.name}`,
      modelUserKey: `${model.singularName}`
    };

    const menu = {
      displayName: `${model.displayName}`,
      name: menuName,
      sequenceNumber: nextMenuSequenceNumber,
      actionUserKey: actionName,
      moduleUserKey: `${model.module.name}`,
      parentMenuItemUserKey: "",
      iconName: "menu"
    };

    const modelListview = {
      name: listViewName,
      displayName: `${model.displayName}`,
      type: "list",
      context: "{}",
      moduleUserKey: `${model.module.name}`,
      modelUserKey: `${model.singularName}`,
      layout: {
        type: "list",
        attrs: {
          pagination: true,
          pageSizeOptions: [
            10,
            25,
            50
          ],
          enableGlobalSearch: true,
          create: true,
          edit: true,
          delete: true
        },
        children: listViewLayoutFields
      }
    };

    const modelTreeview = {
      name: treeViewName,
      displayName: `${model.displayName}`,
      type: "tree",
      context: "{}",
      moduleUserKey: `${model.module.name}`,
      modelUserKey: `${model.singularName}`,
      layout: {
        type: "tree",
        attrs: {
          pagination: true,
          pageSizeOptions: [
            10,
            25,
            50
          ],
          enableGlobalSearch: true,
          create: true,
          edit: true,
          delete: true
        },
        children: treeViewLayoutFields
      }
    };

    const modelFormView = {
      name: formViewName,
      displayName: `${model.displayName}`,
      type: "form",
      context: "{}",
      moduleUserKey: `${model.module.name}`,
      modelUserKey: `${model.singularName}`,
      layout: {
        type: "form",
        attrs: { name: "form-1", label: `${model.displayName}`, className: "grid" },
        children: [
          {
            type: "sheet",
            attrs: { name: "sheet-1" },
            children: [
              {
                type: "row",
                attrs: { name: "sheet-1" },
                children: [
                  {
                    type: "column",
                    attrs: { name: "group-1", label: "", className: "col-12 sm:col-12 md:col-6 lg:col-6" },
                    children: column1Fields
                  },
                  // {
                  //   type: "column",
                  //   attrs: { name: "group-2", label: "", className: "col-12 sm:col-12 md:col-6 lg:col-6" },
                  //   children: column2Fields
                  // }
                ]
              },
            ]
          }
        ]
      }
    };

    // Utility function to check if an item with the same name already exists
    const notExists = (arr: any[], name: string) => !arr.some(item => item.name === name);

    if (notExists(metaData.menus, menuName)) {
      metaData.menus.push(menu);
    }

    if (notExists(metaData.actions, actionName)) {
      metaData.actions.push(action);
    }

    if (notExists(metaData.actions, treeViewActionName)) {
      metaData.actions.push(treeViewAction);
    }

    if (notExists(metaData.views, listViewName)) {
      metaData.views.push(modelListview);
    }

    if (notExists(metaData.views, treeViewName)) {
      metaData.views.push(modelTreeview);
    }

    if (notExists(metaData.views, formViewName)) {
      metaData.views.push(modelFormView);
    }
    // metaData.menus.push(menu);
    // metaData.actions.push(action);
    // metaData.views.push(modelListview);
    // metaData.views.push(modelFormView);
  }

  //Populate the View, Actions and Menus in the database
  private async populateVAMConfigInDb(model: ModelMetadata) {
    const jsonFieldsList = model.fields.filter((field: FieldMetadata) => field.isSystem !== true);

    const listViewLayout = jsonFieldsList.map(field => ({
      type: "field",
      attrs: {
        name: `${field.name}`,
        isSearchable: true,
      }
    }));

    const treeViewLayout = jsonFieldsList.map(field => ({
      type: "field",
      attrs: {
        name: `${field.name}`,
        isSearchable: true,
      }
    }));

    const formViewLayout = jsonFieldsList.map(field => ({
      type: "field",
      attrs: {
        name: `${field.name}`
      }
    }));

    const midIndex = Math.ceil(formViewLayout.length / 2);
    const firstHalf = formViewLayout.slice(0, midIndex);
    const secondHalf = formViewLayout.slice(midIndex);

    const resolvedModule = await this.dataSource.getRepository(ModuleMetadata).findOne({
      where: { id: model.module.id }
    });

    const viewRepo = this.dataSource.getRepository(ViewMetadata);
    const actionRepo = this.dataSource.getRepository(ActionMetadata);
    const menuRepo = this.dataSource.getRepository(MenuItemMetadata);

    const modelViews = [
      {
        name: `${model.singularName}-list-view`,
        displayName: `${model.displayName}`,
        type: 'list',
        context: "{}",
        module: resolvedModule,
        model: model,
        layout: JSON.stringify({
          type: "list",
          attrs: {
            pagination: true,
            pageSizeOptions: [10, 25, 50],
            enableGlobalSearch: true,
            create: true,
            edit: true,
            delete: true
          },
          children: listViewLayout
        }, null, 3)
      },
      {
        name: `${model.singularName}-tree-view`,
        displayName: `${model.displayName}`,
        type: 'tree',
        context: "{}",
        module: resolvedModule,
        model: model,
        layout: JSON.stringify({
          type: "tree",
          attrs: {
            pagination: true,
            pageSizeOptions: [10, 25, 50],
            enableGlobalSearch: true,
            create: true,
            edit: true,
            delete: true
          },
          children: treeViewLayout
        }, null, 3)
      },
      {
        name: `${model.singularName}-form-view`,
        displayName: `${model.displayName}`,
        type: 'form',
        context: "{}",
        module: resolvedModule,
        model: model,
        layout: JSON.stringify({
          type: "form",
          attrs: { name: "form-1", label: `${model.displayName}`, className: "grid" },
          children: [
            {
              type: "sheet",
              attrs: { name: "sheet-1" },
              children: [
                {
                  type: "row",
                  attrs: { name: "group-1", label: "", className: "" },
                  children: [
                    {
                      type: "column",
                      attrs: { name: "group-1", label: "", className: "col-12 sm:col-12 md:col-6 lg:col-6" },
                      children: firstHalf
                    },
                    {
                      type: "column",
                      attrs: { name: "group-2", label: "", className: "col-12 sm:col-12 md:col-6 lg:col-6" },
                      children: secondHalf
                    }
                  ]
                }
              ]
            }
          ]
        }, null, 3)
      }
    ];

    for (const view of modelViews) {
      const existingView = await viewRepo.findOne({ where: { name: view.name } });

      if (!existingView) {
        const createdView = viewRepo.create(view);
        await viewRepo.save(createdView);
      }
    }

    let view = await viewRepo.findOne({ where: { name: `${model.singularName}-list-view` } });
    let treeView = await viewRepo.findOne({ where: { name: `${model.singularName}-tree-view` } });

    const actionData = {
      displayName: `${model.displayName} List Action`,
      name: `${model.singularName}-list-action`,
      type: "solid",
      domain: "" as any,
      context: "" as any,
      customComponent: "",
      customIsModal: true,
      serverEndpoint: "",
      view: view,
      module: resolvedModule,
      model: model
    };

    const treeViewActionData = {
      displayName: `${model.displayName} Tree View Action`,
      name: `${model.singularName}-tree-view-action`,
      type: "solid",
      domain: "",
      context: "",
      customComponent: ``,
      customIsModal: true,
      serverEndpoint: "",
      view: treeView,
      module: resolvedModule,
      model: model
    };

    let existingAction = await actionRepo.findOne({ where: { name: actionData.name } });
    let existingTreeViewAction = await actionRepo.findOne({ where: { name: treeViewActionData.name } });

    if (!existingAction) {
      const createdAction = actionRepo.create(actionData);
      existingAction = await actionRepo.save(createdAction);
    }

    if (!existingTreeViewAction) {
      const createdTreeViewAction = actionRepo.create(treeViewActionData);
      existingTreeViewAction = await actionRepo.save(createdTreeViewAction);
    }

    const roleRepo = this.dataSource.getRepository(RoleMetadata);
    const adminRole = await roleRepo.findOne({
      where: { name: 'Admin' },
      select: { id: true, name: true }
    });

    if (!adminRole) {
      throw new NotFoundException(`Entity #Admin not found`);
    }

    const menuData = {
      displayName: `${model.displayName}`,
      name: `${model.singularName}-menu-item`,
      sequenceNumber: 1,
      action: existingAction,
      module: resolvedModule,
      parentMenuItemUserKey: ""
    };

    let existingMenu = await menuRepo.findOne({ where: { name: menuData.name } });

    if (!existingMenu) {
      const createdMenu = menuRepo.create(menuData);
      existingMenu = await menuRepo.save(createdMenu);
      await menuRepo
        .createQueryBuilder()
        .relation(MenuItemMetadata, 'roles')
        .of(existingMenu.id)
        .add(adminRole.id);
    }
  }

  async generateCode(options: CodeGenerationOptions) {
    const query = {
      populate: ["module", "fields"]
    };

    const model = options.modelId
      ? await this.findOne(options.modelId, query)
      : await this.findOneByUserKey(options.modelUserKey, query.populate);

    options.fieldIdsForRemoval = model.fields
      .filter(field => field.isMarkedForRemoval)
      .map(field => field.id);

    const refreshModelCodeOutput = await this.generateModelCode(options);
    const removeFieldCodeOuput = await this.generateRemoveFieldsCode(options);
    return { model, removeFieldCodeOuput, refreshModelCodeOutput };
  }

  async generateRemoveFieldsCode(options: CodeGenerationOptions): Promise<string> {
    if (!options.modelId && !options.modelUserKey) {
      throw new BadRequestException(ERROR_MESSAGES.MODEL_REQUIRED_FOR_CODE_GENERATION);
    }

    if (!options.fieldIdsForRemoval || options.fieldIdsForRemoval.length === 0) {
      return "";
    }

    const query = {
      populate: ["module", "fields"]
    };
    const model = options.modelId ? await this.findOne(options.modelId, query) : await this.findOneByUserKey(options.modelUserKey, query.populate);

    //Filter out the fields by id
    const fieldsForRemoval = model.fields.filter((field) => options.fieldIdsForRemoval.includes(+field.id));
    const removeOutput = await this.executeRemoveFieldsCommand(model, fieldsForRemoval, options.dryRun);
    // Remove the fields from the database as well. This also checks, if the field is marked for removal
    for (const field of fieldsForRemoval) {
      if (field.isMarkedForRemoval) {
        await this.fieldMetadataService.delete(field.id);
      }
    }

    // Remove the fields from metadata json file 

    const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module.name);
    const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

    // Check if the model already exists in `models`
    const existingModelIndex = metaData.moduleMetadata.models.findIndex(
      (existingModel: any) => existingModel.singularName === model.singularName
    );

    const modelMetaData = metaData.moduleMetadata.models[existingModelIndex];

    // Remove fields marked for removal from modelMetaData.fields
    modelMetaData.fields = modelMetaData.fields.filter((field: any) => field.isMarkedForRemoval !== true);

    if (existingModelIndex !== -1) {
      // Update the existing model
      metaData.moduleMetadata.models[existingModelIndex] = modelMetaData;
    } else {
      // Add the new model
      metaData.moduleMetadata.models.push(modelMetaData);
    }

    // Write the updated object back to the file
    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);

    return removeOutput;
  }
  async generateModelCode(options: CodeGenerationOptions): Promise<string> {
    if (!options.modelId && !options.modelUserKey) {
      throw new BadRequestException(ERROR_MESSAGES.MODEL_REQUIRED_FOR_CODE_GENERATION);
    }

    const query = {
      populate: ["module", "fields", "parentModel", "parentModel.module"]
    };
    const model = options.modelId ? await this.findOne(options.modelId, query) : await this.findOneByUserKey(options.modelUserKey, query.populate);

    //Execute the schematic command to refresh the model
    const refreshOuput = await this.executeRefreshModelCommand(model, options.dryRun);

    return `${refreshOuput}`;
  }

  private async executeRefreshModelCommand(model: ModelMetadata, dryRun: boolean = false): Promise<string> {
    const output = await this.schematicService.executeSchematicCommand(
      REFRESH_MODEL_COMMAND,
      {
        module: model.module.name,
        model: model.singularName,
      },
      dryRun
    );
    this.logger.debug(`Schematic output : ${output}`);
    return output;
  }

  private async executeRemoveFieldsCommand(model: ModelMetadata, fieldsForRemoval: FieldMetadata[], dryRun: boolean = false): Promise<string> {
    if (!fieldsForRemoval || fieldsForRemoval.length === 0) {
      return "";
    }
    const output = await this.schematicService.executeSchematicCommand(
      REMOVE_FIELDS_COMMAND,
      {
        module: model.module.name,
        model: model.singularName,
        fieldNamesForRemoval: fieldsForRemoval.map(field => field.name),
      },
      dryRun
    );

    this.logger.debug(`Schematic output : ${output}`);
    return output;
  }

  async updateUserKey(data: any) {
    const { modelName, fieldName } = data;

    const model = await this.modelMetadataRepo.findOne({
      where: { singularName: modelName },
      relations: ['fields', 'userKeyField'],
    });

    if (!model) {
      throw new Error(`Model with name ${modelName} not found`);
    }

    if (model.userKeyField) {
      throw new Error(`User key is already set to ${model.userKeyField.name}. No changes were made.`);
    }

    const fieldToUpdate = model.fields.find(field => field.name === fieldName);
    if (!fieldToUpdate) {
      throw new Error(`Field with name ${fieldName} not found in model ${modelName}`);
    }

    fieldToUpdate.isUserKey = true;

    model.userKeyField = fieldToUpdate;

    await this.modelMetadataRepo.save(model);

    return {
      message: `User key has been successfully updated to ${fieldName}.`,
      success: true
    };
  }

  private async getRelationInverseFields(modelId: number, repo: Repository<FieldMetadata>): Promise<FieldMetadata[]> {
    return await repo.find({
      where: {
        model: {
          id: modelId
        },
        type: SolidFieldType.relation,
        relationCreateInverse: true
      },
      relations: {
        model: {
          module: true
        }
      }
    });
  }

  async navigation(navigationDto: NavigationDto) {
    const { recordId, modelName, ...basicFilterDto } = navigationDto;

    const modelServiceInstanceWrapper =
      this.introspectService.getProvider(`${classify(modelName)}Service`);

    if (!modelServiceInstanceWrapper) {
      throw new BadRequestException(
        `Invalid model name (${modelName}) specified in Navigation.`,
      );
    }

    const modelService: CRUDService<any> = modelServiceInstanceWrapper.instance;

    const recs = await modelService.find(basicFilterDto);

    // navigation only works for paginated results
    if (!('records' in recs) || !('currentPage' in recs.meta)) {
      return {
        prev: null,
        next: null,
        meta: null,
      };
    }

    const { records, meta } = recs;

    // --------------------
    // Find record index in page
    // --------------------
    const index = records.findIndex(r =>
      String(r.id) === String(recordId) ||
      (r.initialEntityVersionId && String(r.initialEntityVersionId) === String(recordId))
    );

    if (index === -1) {
      throw new BadRequestException(`Record not found in current page`);
    }

    // --------------------
    // Pagination calculations
    // --------------------
    const limit = meta.perPage;
    const currentOffset = (meta.currentPage - 1) * meta.perPage;
    const currentIndexGlobal = currentOffset + index + 1;

    let prev: { record: any; offset: number; limit: number } | null = null;
    let next: { record: any; offset: number; limit: number } | null = null;

    // --------------------
    // PREV
    // --------------------
    if (index > 0) {
      prev = {
        record: records[index - 1],
        offset: currentOffset,
        limit,
      };
    } else if (meta.prevPage !== null) {
      const prevOffset = (meta.prevPage - 1) * meta.perPage;

      const prevPage = await modelService.find({
        ...basicFilterDto,
        offset: prevOffset,
        limit,
      });

      if ('records' in prevPage) {
        const record = prevPage.records.at(-1) ?? null;
        if (record) {
          prev = {
            record,
            offset: prevOffset,
            limit,
          };
        }
      }
    }

    // --------------------
    // NEXT
    // --------------------
    if (index < records.length - 1) {
      next = {
        record: records[index + 1],
        offset: currentOffset,
        limit,
      };
    } else if (meta.nextPage !== null) {
      const nextOffset = (meta.nextPage - 1) * meta.perPage;

      const nextPage = await modelService.find({
        ...basicFilterDto,
        offset: nextOffset,
        limit,
      });

      if ('records' in nextPage) {
        const record = nextPage.records[0] ?? null;
        if (record) {
          next = {
            record,
            offset: nextOffset,
            limit,
          };
        }
      }
    }

    // --------------------
    // RESPONSE
    // --------------------
    return {
      prev: prev
        ? {
          recordId: prev.record.id,
          offset: prev.offset,
          limit: prev.limit,
        }
        : null,

      next: next
        ? {
          recordId: next.record.id,
          offset: next.offset,
          limit: next.limit,
        }
        : null,
      meta: {
        totalRecords: meta.totalRecords,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        totalPages: meta.totalPages,

        currentIndexInPage: index,
        currentIndexGlobal,

        hasPrev: !!prev,
        hasNext: !!next,

        prevPage: meta.prevPage,
        nextPage: meta.nextPage,
      },

    };
  }

}
