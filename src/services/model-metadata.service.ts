import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { ModuleMetadata } from '../entities/module-metadata.entity';

import { classify, dasherize } from '@angular-devkit/core/src/utils/strings';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { DisallowInProduction } from 'src/decorators/disallow-in-production.decorator';
import { SolidFieldType } from 'src/dtos/create-field-metadata.dto';
import { PermissionMetadata } from 'src/entities/permission-metadata.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { FieldMetadataRepository } from 'src/repository/field-metadata.repository';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateModelMetaDataDto } from '../dtos/update-model-metadata.dto';
import { ActionMetadata } from '../entities/action-metadata.entity';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { ViewMetadata } from '../entities/view-metadata.entity';
import {
  REFRESH_MODEL_COMMAND,
  REMOVE_FIELDS_COMMAND,
  SchematicService
} from '../helpers/schematic.service';
import { CodeGenerationOptions } from '../interfaces';
import { CrudHelperService } from './crud-helper.service';
import { FieldMetadataService } from './field-metadata.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { RoleMetadataService } from './role-metadata.service';

@Injectable()
export class ModelMetadataService {
  private logger = new Logger('ModelMetadataService');
  constructor(
    // @InjectRepository(ModelMetadata)
    // private readonly modelMetadataRepo: Repository<ModelMetadata>,
    // @InjectRepository(FieldMetadata)
    // private readonly fieldMetadataRepo: Repository<FieldMetadata>,
    private readonly modelMetadataRepo: ModelMetadataRepository,
    private readonly fieldMetadataRepo: FieldMetadataRepository,
    private readonly schematicService: SchematicService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly crudHelperService: CrudHelperService,
    private readonly mediaStorageProviderMetadataService: MediaStorageProviderMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly roleService: RoleMetadataService,
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    // No longer used. 
    // private readonly generateCodePublihser: GenerateCodePublisherDatabase,
  ) { }

  async findMany(basicFilterDto: BasicFilterDto) {
    const alias = 'modelMetadata';
    // Extract the required keys from the input query
    let { limit, offset } = basicFilterDto;

    // Create above query on pincode table using query builder
    var qb: SelectQueryBuilder<ModelMetadata> = await this.modelMetadataRepo.createSecurityRuleAwareQueryBuilder(alias)
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
    } catch (error) {
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
    } catch (error) {
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

    } catch (error) {
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

    } catch (error) {
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

  async removeBySingularName(singularName: string) {
    try {
      const entity = await this.findOneBySingularName(singularName);
      await this.cleanupOnDelete(entity.id);
      const r = await this.modelMetadataRepo.remove(entity);
      return r;
    } catch (error) {
    }
  }

  async deleteMany(ids: number[]): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
    }
    const removedEntities = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const entity = await this.modelMetadataRepo.findOne({
        where: {
          //@ts-ignore
          id: id,
        }
      });
      // if (!entity) {
      //   throw new Error(`Entity with id ${ id } not found`);
      // }
      await this.cleanupOnDelete(entity.id);
      const r = await this.modelMetadataRepo.remove(entity);
      removedEntities.push(r);
    }

    return removedEntities
  }

  async remove(id: number) {
    const entity = await this.findOne(id);
    await this.cleanupOnDelete(entity.id);
    const r = await this.modelMetadataRepo.remove(entity);
    return r
  }

  async cleanupOnDelete(modelEntityId: number) {
    const modelEntity = await this.modelMetadataRepo.findOne({
      where: {
        // @ts-ignore
        id: modelEntityId,
      },
      relations: ['module']
    });

    if (!modelEntity) {
      this.logger.log(`Invalid modelEntityId: ${modelEntityId} unable to resolve model metadata`);
      return;
    }
    if (modelEntity.id !== modelEntityId) {
      this.logger.log(`Invalid modelEntityId: ${modelEntityId} unable to resolve model metadata id ${modelEntity.id} not matching with the one passed as argument ${modelEntityId}`);
      return;
    }

    this.logger.log(`Cleaning up for model: ${modelEntity.singularName} belonging to module: ${modelEntity.module.name}`);

    const modulePath = await this.moduleMetadataHelperService.getModulePath(modelEntity.module.name);
    // /Users/harishpatel/Code/javascript/school-fees-portal/solid-api/src/solid-core
    this.logger.log(`Module path: ${modulePath}`);

    const filesToDelete = [];
    // <singularName>.entity.ts | The TypeORM model that needs to be deleted. | Automatic
    const entityFilePath = `${modulePath}/entities/${dasherize(modelEntity.singularName)}.entity.ts`;
    filesToDelete.push(entityFilePath);
    this.logger.log(`About to delete entity file path: ${entityFilePath}`);

    // <singularName>.create.dto.ts | The TypeORM model that needs to be deleted. | Automatic
    const createDtoFilePath = `${modulePath}/dtos/create-${dasherize(modelEntity.singularName)}.dto.ts`;
    filesToDelete.push(createDtoFilePath);
    this.logger.log(`About to delete create DTO file path: ${createDtoFilePath}`);

    // <singularName>.update.dto.ts | The TypeORM model that needs to be deleted. | Automatic
    const updateDtoFilePath = `${modulePath}/dtos/update-${dasherize(modelEntity.singularName)}.dto.ts`;
    filesToDelete.push(updateDtoFilePath);
    this.logger.log(`About to delete update DTO file path: ${updateDtoFilePath}`);

    // <singularName>.repository.ts | The TypeORM model that needs to be deleted. | Automatic
    const repositoryFilePath = `${modulePath}/repositories/${dasherize(modelEntity.singularName)}.repository.ts`;
    filesToDelete.push(repositoryFilePath);
    this.logger.log(`About to delete repository file path: ${repositoryFilePath}`);

    // <singularName>.service.ts | The TypeORM model that needs to be deleted. | Automatic
    const serviceFilePath = `${modulePath}/services/${dasherize(modelEntity.singularName)}.service.ts`;
    filesToDelete.push(serviceFilePath);
    this.logger.log(`About to delete service file path: ${serviceFilePath}`);

    // <singularName>.controller.ts | The TypeORM model that needs to be deleted. | Automatic
    const controllerFilePath = `${modulePath}/controllers/${dasherize(modelEntity.singularName)}.controller.ts`;
    filesToDelete.push(controllerFilePath);
    this.logger.log(`About to delete controller file path: ${controllerFilePath}`);

    for (let i = 0; i < filesToDelete.length; i++) {
      const fileToDelete = filesToDelete[i];
      try {
        await fs.unlink(fileToDelete);
        this.logger.log(`Deleted file: ${fileToDelete}`);
      } catch (error) {
        this.logger.error(`Error deleting file: ${fileToDelete}`, error);
      }
    }

    // Delete the permissions, menu, actions & views related to this model.
    const controllerName = `${classify(modelEntity.singularName)}Controller`;
    const permissionNames = [
      `${controllerName}.delete`,
      `${controllerName}.deleteMany`,
      `${controllerName}.findOne`,
      `${controllerName}.findMany`,
      `${controllerName}.recover`,
      `${controllerName}.recoverMany`,
      `${controllerName}.partialUpdate`,
      `${controllerName}.update`,
      `${controllerName}.insertMany`,
      `${controllerName}.create`,
    ];
    const permissionsRepo = this.dataSource.getRepository(PermissionMetadata);
    const permissionsToDelete = await permissionsRepo.find({
      where: { name: In(permissionNames) },
      relations: ['roles'],
    });

    // Remove role associations first
    for (const permission of permissionsToDelete) {
      if (permission.roles?.length) {
        await this.dataSource
          .createQueryBuilder()
          .relation(PermissionMetadata, 'roles')
          .of(permission) // permission instance or its ID
          .remove(permission.roles); // remove all linked roles
      }
    }

    await permissionsRepo.remove(permissionsToDelete);

    // Delete actions
    const actionRepo = this.dataSource.getRepository(ActionMetadata);
    const action = await actionRepo.findOne({ where: { model: { id: modelEntity.id } } });
    await actionRepo.delete({ model: { id: modelEntity.id } });

    // Delete menu items
    const menuItemRepo = this.dataSource.getRepository(MenuItemMetadata);
    if (action) {
      const menuItems = await menuItemRepo.find({ where: { action: { id: action.id } } });
      for (let i = 0; i < menuItems.length; i++) {
        const menuItem = menuItems[i];
        await menuItemRepo.remove(menuItem);
      }
    }

    // Delete view 
    const viewRepo = this.dataSource.getRepository(ViewMetadata);
    await viewRepo.delete({ model: { id: modelEntity.id } })

    // <moduleName>-metadata.json | Remove references to this model in the model metadata, menu, action & view sections. | Automatic
    const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(modelEntity.module.name);
    const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
    if (metaData) {
      const existingModelIndex = metaData.moduleMetadata.models.findIndex(
        (existingModel: any) => existingModel.singularName === modelEntity.singularName
      );

      // Remove the model to be deleted from the metadata
      if (existingModelIndex !== -1) {
        metaData.moduleMetadata.models.splice(existingModelIndex, 1);
      }

      // Remove references to this model in the menu, action & view sections.
      metaData.moduleMetadata.menus = metaData.moduleMetadata.menus.filter(
        (menu: any) => menu.modelUserKey !== modelEntity.singularName
      );
      metaData.moduleMetadata.actions = metaData.moduleMetadata.actions.filter(
        (action: any) => action.modelUserKey !== modelEntity.singularName
      );
      metaData.moduleMetadata.views = metaData.moduleMetadata.views.filter(
        (view: any) => view.modelUserKey !== modelEntity.singularName
      );

      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);
    }

    // <moduleName>.module.ts | Remove all references and imports of the above files. | Manual (X)
    // const moduleFilePath = path.resolve(modulePath, `${dasherize(modelEntity.module.name)}.module.ts`);

    // this.logger.log(`Working on module file ${moduleFilePath}`);
    // const project = new Project();
    // const sourceFile = project.addSourceFileAtPath(moduleFilePath);

    // // Remove import declarations related to deleted files
    // sourceFile.getImportDeclarations().forEach(importDecl => {
    //   const moduleSpecifier = importDecl.getModuleSpecifierValue();
    //   const resolvedPath = importDecl.getModuleSpecifierSourceFile()?.getFilePath() || '';
    //   if (filesToDelete.some(file => resolvedPath.endsWith(file))) {
    //     importDecl.remove();
    //   }
    // });

    // // Remove identifiers from `@Module` metadata (imports, providers, controllers)
    // const moduleDecorator = sourceFile.getFirstDescendantByKind(SyntaxKind.Decorator);
    // const objectLiteral = moduleDecorator?.getCallExpression()?.getArguments()?.[0];

    // if (objectLiteral && objectLiteral.getKind() === SyntaxKind.ObjectLiteralExpression) {
    //   const objectLiteralExpr = objectLiteral.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

    //   for (const propName of ['imports', 'providers', 'controllers', 'exports']) {
    //     const prop = objectLiteralExpr.getProperty(propName);
    //     if (prop && prop.getKind() === SyntaxKind.PropertyAssignment) {
    //       const elements = prop.getFirstDescendantByKind(SyntaxKind.ArrayLiteralExpression);
    //       elements?.getElements().forEach(el => {
    //         const text = el.getText();
    //         if (filesToDelete.some(file => text.toLowerCase().includes(file.split('.')[0]))) {
    //           // @ts-ignore
    //           el.remove();
    //         }
    //       });
    //     }
    //   }
    // }

    // // Save changes
    // sourceFile.saveSync();

    // Run seeder to reflect the removal. 

    // - | Drop database table | Removes the database table from the DB, this is a very risky step. Best to review all relations to other models etc and then do this manually | Manual (X)

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
    } catch (error) {
      this.logger.error('generateVAMConfig Transaction failed:', error);
      throw error;
    }
  }

  private async populateVAMConfigInFile(model: ModelMetadata) {
    try {
      const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module.name);
      const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

      const listViewLayoutFields = [{ type: "field", attrs: { name: `id` } }];
      const formViewLayoutFields = [];

      for (let i = 0; i < model.fields.length; i++) {
        const field = model.fields[i];
        if (field.isSystem) continue;
        listViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}` } })
        formViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}` } })
      }
      this.populateVAMConfigInFileInternal(formViewLayoutFields, model, listViewLayoutFields, metaData);
      // Write the updated object back to the file
      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);

    } catch (error) {
      // console.error('File creation failed:', error);
      this.logger.error('File updation failed for View, action, menus config:', error);
      throw new Error('File updation failed for View, action, menus config'); // Trigger rollback
    }
  }

  // Populate the View, Actions and Menus in the config file
  private populateVAMConfigInFileInternal(formViewLayoutFields: any[], model: ModelMetadata, listViewLayoutFields: { type: string; attrs: { name: string; }; }[], metaData: any) {
    const column1Fields = [];
    const column2Fields = [];

    // Distribute fields between two columns
    for (let i = 0; i < formViewLayoutFields.length; i++) {
      if (i % 2 === 0) {
        column1Fields.push(formViewLayoutFields[i]);
      } else {
        column2Fields.push(formViewLayoutFields[i]);
      }
    }
    const actionName = `${model.singularName}-list-action`;
    const viewName = `${model.singularName}-list-view`;
    const formViewName = `${model.singularName}-form-view`;
    const menuName = `${model.singularName}-menu-item`;

    const action = {
      displayName: `${model.displayName} List Action`,
      name: actionName,
      type: "solid",
      domain: "",
      context: "",
      customComponent: ``,
      customIsModal: true,
      serverEndpoint: "",
      viewUserKey: viewName,
      moduleUserKey: `${model.module.name}`,
      modelUserKey: `${model.singularName}`
    };

    const menu = {
      displayName: `${model.displayName}`,
      name: menuName,
      sequenceNumber: 1,
      actionUserKey: actionName,
      moduleUserKey: `${model.module.name}`,
      parentMenuItemUserKey: ""
    };

    const modelListview = {
      name: viewName,
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
                  {
                    type: "column",
                    attrs: { name: "group-2", label: "", className: "col-12 sm:col-12 md:col-6 lg:col-6" },
                    children: column2Fields
                  }
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

    if (notExists(metaData.views, viewName)) {
      metaData.views.push(modelListview);
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

    let existingAction = await actionRepo.findOne({ where: { name: actionData.name } });

    if (!existingAction) {
      const createdAction = actionRepo.create(actionData);
      existingAction = await actionRepo.save(createdAction);
    }

    const adminRole = await this.roleService.findRoleByName('Admin');

    const menuData = {
      displayName: `${model.displayName}`,
      name: `${model.singularName}-menu-item`,
      sequenceNumber: 1,
      action: existingAction,
      module: resolvedModule,
      roles: [adminRole],
      parentMenuItemUserKey: ""
    };

    let existingMenu = await menuRepo.findOne({ where: { name: menuData.name } });

    if (!existingMenu) {
      const createdMenu = menuRepo.create(menuData);
      await menuRepo.save(createdMenu);
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
    fieldsForRemoval.forEach((field: FieldMetadata) => {
      if (field.isMarkedForRemoval) {
        this.fieldMetadataService.delete(field.id);
      }
    });

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
    const fieldsForRefresh = model.fields.filter((field) => !field.isMarkedForRemoval);
    const output = await this.schematicService.executeSchematicCommand(
      REFRESH_MODEL_COMMAND,
      {
        module: model.module.name,
        model: model.singularName,
        moduleDisplayName: model.module.displayName,
        dataSource: model.dataSource,
        table: model.tableName,
        fields: fieldsForRefresh,
        modelEnableSoftDelete: model.enableSoftDelete,
        parentModel: model.parentModel?.singularName,
        parentModule: model.parentModel?.module?.name,
        draftPublishWorkflowEnabled: model.draftPublishWorkflow,
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
        fields: fieldsForRemoval,
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

}
