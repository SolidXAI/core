import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { ModuleMetadata } from '../entities/module-metadata.entity';

import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateModelMetaDataDto } from '../dtos/update-model-metadata.dto';
import { FieldMetadata } from '../entities/field-metadata.entity';
import {
  REFRESH_MODEL_COMMAND,
  REMOVE_FIELDS_COMMAND,
  SchematicService
} from '../helpers/schematic.service';
import { CodeGenerationOptions } from '../interfaces';
import { CrudHelperService } from './crud-helper.service';
import { FieldMetadataService } from './field-metadata.service';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
import { ViewMetadata } from '../entities/view-metadata.entity';
import { ActionMetadata } from '../entities/action-metadata.entity';
import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { RoleMetadataService } from './role-metadata.service';
import { PermissionMetadataSeederService } from 'src/seeders/permission-metadata-seeder.service';

@Injectable()
export class ModelMetadataService {
  private logger = new Logger('ModelMetadataService');
  constructor(
    @InjectRepository(ModelMetadata)
    private readonly modelMetadataRepo: Repository<ModelMetadata>,
    @InjectRepository(FieldMetadata)
    private readonly fieldMetadataRepo: Repository<FieldMetadata>,
    private readonly schematicService: SchematicService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly crudHelperService: CrudHelperService,
    private readonly mediaStorageProviderMetadataService: MediaStorageProviderMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly roleService: RoleMetadataService,
  ) { }

  async findMany(basicFilterDto: BasicFilterDto) {
    const alias = 'modelMetadata';
    // Extract the required keys from the input query
    let { limit, offset } = basicFilterDto;

    // Create above query on pincode table using query builder
    var qb: SelectQueryBuilder<ModelMetadata> = this.modelMetadataRepo.createQueryBuilder(alias)
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
      throw new NotFoundException(`entity #${id} not found`);
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
      throw new NotFoundException(`entity #${singularName} not found`);
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
      throw new NotFoundException(`entity #${singularName} not found`);
    }
    return entity;
  }

  async create(createDto: CreateModelMetadataDto) {

    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        // Step 1: Write initial data to the database
        const model = await this.createInDB(manager, createDto);
        await this.createInFile(model.id, manager.getRepository(ModelMetadata));
        return model
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  async update(id: number, updateModelMetaDataDto: UpdateModelMetaDataDto) {
    //To DO start the transaction 
    // call create In db
    // call createInfile

    try {
      return await this.dataSource.transaction(async (manager: EntityManager) => {
        // Step 1: Write initial data to the database
        const model = await this.updateInDb(manager, id, updateModelMetaDataDto)
        await this.updateInFile(model.id, manager.getRepository(ModelMetadata));
        // return model
      });
    } catch (error) {
      console.error('Transaction failed:', error);
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

      const fieldMetadataObject = this.fieldMetadataRepo.create(fieldMetadata);
      const affectedField = await manager.save(fieldMetadataObject);

      if (fieldMetadata.isUserKey) {
        userKeyField = affectedField;
      }
      listViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}`, label: `${affectedField.displayName}`, sortable: true, filterable: true } })
      formViewLayout.push({ type: "field", attrs: { name: `${affectedField.name}`, label: `${affectedField.displayName}` } })

    }

    // Now that we have created fields & model update the model to stamp the userKeyField. 
    if (userKeyField) {
      modelMetaDataWithoutFields['userKeyField'] = userKeyField;
      const updatedModelMetadataDto = this.modelMetadataRepo.create(modelMetaDataWithoutFields);
      model = await manager.save(updatedModelMetadataDto);
    }

    // const modelViews = [{
    //   name: `${model.singularName}-list-view`,
    //   displayName: `${model.displayName}`,
    //   type: 'list',
    //   context: "{}",
    //   module: resolvedModule,
    //   model: model,
    //   layout: JSON.stringify({
    //     type: "list",
    //     attrs: {
    //       pagination: true,
    //       pageSizeOptions: [
    //         10,
    //         25,
    //         50
    //       ],
    //       enableGlobalSearch: true,
    //       create: true,
    //       edit: true,
    //       delete: true
    //     },
    //     children: listViewLayout
    //   }, null, 2)
    // },
    // {
    //   name: `${model.singularName}-form-view`,
    //   displayName: `${model.displayName}`,
    //   type: 'form',
    //   context: "{}",
    //   module: model.module,
    //   model: model,
    //   layout: JSON.stringify(
    //     {
    //       type: "form",
    //       attrs: { name: "form-1", label: `${model.displayName}`, className: "grid" },
    //       children: [
    //         {
    //           type: "sheet",
    //           attrs: { name: "sheet-1" },
    //           children: [
    //             {
    //               type: "row",
    //               attrs: { name: "group-1", label: "", className: "" },
    //               children: [
    //                 {
    //                   type: "column",
    //                   attrs: { name: "group-1", label: "", className: "col-6" },
    //                   children: formViewLayout
    //                 }
    //               ]
    //             }
    //           ]
    //         }
    //       ]
    //     }, null, 2)
    // }
    // ];
    // const viewRepo = manager.getRepository(ViewMetadata);
    // for (let j = 0; j < modelViews.length; j++) {
    //   const view = modelViews[j];
    //   const createdView = await viewRepo.create(view);
    //   await viewRepo.save(createdView);
    // }

    // const view = await viewRepo.findOneBy({ name: `${model.singularName}-list-view` });

    // const action = {
    //   displayName: `${model.displayName} List View`,
    //   name: `${model.singularName}-list-view`,
    //   type: "solid",
    //   domain: "",
    //   context: "",
    //   customComponent: `/admin/address-master/${model.singularName}/all`,
    //   customIsModal: true,
    //   serverEndpoint: "",
    //   view: view,
    //   module: resolvedModule,
    //   model: model
    // };
    // const actionRepo = manager.getRepository(ActionMetadata);
    // const createdAction = await actionRepo.create(action);
    // const newAction = await actionRepo.save(createdAction);

    // const adminRole = await this.roleService.findRoleByName('Admin');

    // const menu = {
    //   displayName: `${model.displayName}`,
    //   name: `${model.singularName}`,
    //   sequenceNumber: 1,
    //   action: newAction,
    //   module: resolvedModule,
    //   roles: [adminRole],
    //   parentMenuItemUserKey: ""
    // };

    // const menuRepo = manager.getRepository(MenuItemMetadata);
    // const createdMenu = await menuRepo.create(menu);
    // await menuRepo.save(createdMenu);

    return model;
  }

  async createInFile(modelId: any, repo: Repository<ModelMetadata>) {
    try {
      const model = await repo.findOne({
        where: {
          id: modelId,
        },
        relations: ["fields", "module"], //FIXME: Check with jenender and change to relations to avoid confusion
      });

      const folderPath = path.resolve(process.cwd(), 'module-metadata', model.module.name);
      const filePath = path.join(folderPath, `${model.module.name}-metadata.json`);

      // Read the existing JSON file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const metaData = JSON.parse(fileContent);

      const modelMetaData = {
        singularName: model.singularName,
        pluralName: model.pluralName,
        displayName: model.displayName,
        description: model.description,
        dataSource: model.dataSource,
        dataSourceType: model.dataSourceType,
        fields: []
      }

      const listViewLayoutFields = [{ type: "field", attrs: { name: `id`, label: `Id`, sortable: true, filterable: true } }];
      const formViewLayoutFields = [];

      for (let i = 0; i < model.fields.length; i++) {
        const field = model.fields[i];
        if (!field.isSystem) {

          const fieldsRequiredBasedOnType = await this.fieldMetadataService.fetchCurrentFieldsBasedOnType(field.type);
          const fieldObject: Record<string, any> = {};

          // Assign default or placeholder values for required fields
          fieldsRequiredBasedOnType.forEach((requiredField) => {
            fieldObject[requiredField] = field[requiredField];
          });
          modelMetaData.fields.push(fieldObject);
          listViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}`, label: `${field.displayName}`, sortable: true, filterable: true } })
          formViewLayoutFields.push({ type: "field", attrs: { name: `${field.name}`, label: `${field.displayName}` } })

        }
      }
      const action = {
        displayName: `${model.displayName} List View`,
        name: `${model.singularName}-list-view`,
        type: "solid",
        domain: "",
        context: "",
        customComponent: `/admin/address-master/${model.singularName}/all`,
        customIsModal: true,
        serverEndpoint: "",
        viewUserKey: `${model.singularName}-list-view`,
        moduleUserKey: `${model.module.name}`,
        modelUserKey: `${model.singularName}`
      };

      const menu = {
        displayName: `${model.displayName}`,
        name: `${model.singularName}`,
        sequenceNumber: 1,
        actionUserKey: `${model.singularName}-list-view`,
        moduleUserKey: `${model.module.name}`,
        parentMenuItemUserKey: ""
      };

      const modelListview = {
        name: `${model.singularName}-list-view`,
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
        name: `${model.singularName}-form-view`,
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
                  children: [{
                    type: "column",
                    attrs: { name: "group-1", label: "", className: "col-6" },
                    children: formViewLayoutFields
                  }]
                },
              ]
            }
          ]
        }
      };
      // Update the `models` array
      metaData.moduleMetadata.models.push(modelMetaData);
      metaData.menus.push(menu);
      metaData.actions.push(action);
      metaData.views.push(modelListview);
      metaData.views.push(modelFormView);


      // Write the updated object back to the file
      const updatedContent = JSON.stringify(metaData, null, 2);
      await fs.writeFile(filePath, updatedContent);

    } catch (error) {
      console.error('File creation failed:', error);
      throw new Error('File creation failed, rolling back transaction'); // Trigger rollback
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
      throw new Error(`Model with singular name "${updateModelMetaDataDto.singularName}" not found.`);
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
        relations: ["fields", "fields.mediaStorageProvider", "module"], //FIXME: Check with jenender and change to relations to avoid confusion
      });

      const folderPath = path.resolve(process.cwd(), 'module-metadata', model.module.name);
      const filePath = path.join(folderPath, `${model.module.name}-metadata.json`);

      // Read the existing JSON file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const metaData = JSON.parse(fileContent);

      const modelMetaData = {
        singularName: model.singularName,
        pluralName: model.pluralName,
        displayName: model.displayName,
        description: model.description,
        dataSource: model.dataSource,
        dataSourceType: model.dataSourceType,
        fields: []
      }

      for (let i = 0; i < model.fields.length; i++) {
        const field = model.fields[i];
        if (!field.isSystem && !field.isMarkedForRemoval) {

          const fieldsRequiredBasedOnType = await this.fieldMetadataService.fetchCurrentFieldsBasedOnType(field.type);
          const fieldObject: Record<string, any> = {};

          // Assign default or placeholder values for required fields
          fieldsRequiredBasedOnType.forEach((requiredField) => {
            fieldObject[requiredField] = field[requiredField];

          });
          if (field.type == "mediaSingle" || field.type == "mediaMultiple") {
            delete fieldObject.mediaStorageProviderId
            fieldObject.mediaStorageProviderUserKey = field.mediaStorageProvider.name
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
      console.error('File creation failed:', error);
      throw new Error('File creation failed, rolling back transaction'); // Trigger rollback
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
      return this.modelMetadataRepo.remove(entity);
    } catch (error) {
    }
  }

  async deleteMany(ids: number[]): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error('At least one ID is required for deletion');
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
      removedEntities.push(await this.modelMetadataRepo.remove(entity));
    }

    return removedEntities
  }


  async remove(id: number) {
    const entity = await this.findOne(id);
    return this.modelMetadataRepo.remove(entity);
  }

  async generateCode(options: CodeGenerationOptions): Promise<string> {
    const query = {
      populate: ["module", "fields"]
    };
    const model = options.modelId ? await this.findOne(options.modelId, query) : await this.findOneByUserKey(options.modelUserKey, query.populate);
    options.fieldIdsForRemoval = model.fields.filter((field) => field.isMarkedForRemoval).map((field) => field.id);

    const refreshModelCodeOutput = await this.generateModelCode(options);
    const removeFieldCodeOuput = await this.generateRemoveFieldsCode(options);

    // Extract listViewLayout and formViewLayout from model fields
    const listViewLayout = model.fields.map(field => ({
        type: "field",
        attrs: { 
            name: `${field.name}`, 
            label: `${field.displayName}`, 
            sortable: true, 
            filterable: true 
        }
    }));

    const formViewLayout = model.fields.map(field => ({
        type: "field",
        attrs: { 
            name: `${field.name}`, 
            label: `${field.displayName}` 
        }
    }));

    // Fetch module data
    const resolvedModule = await this.dataSource.getRepository(ModuleMetadata).findOne({
        where: { id: model.module.id }
    });

    // Generate model views
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
            }, null, 2)
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
                                        attrs: { name: "group-1", label: "", className: "col-6" },
                                        children: formViewLayout
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }, null, 2)
        }
    ];

    // Save views
    const viewRepo = this.dataSource.getRepository(ViewMetadata);
    for (const view of modelViews) {
        const createdView = viewRepo.create(view);
        await viewRepo.save(createdView);
    }

    // Fetch the list view
    const view = await viewRepo.findOneBy({ name: `${model.singularName}-list-view` });

    // Generate action
    const action = {
        displayName: `${model.displayName} List View`,
        name: `${model.singularName}-list-view`,
        type: "solid",
        domain: "",
        context: "",
        customComponent: `/admin/address-master/${model.singularName}/all`,
        customIsModal: true,
        serverEndpoint: "",
        view: view,
        module: resolvedModule,
        model: model
    };

    // Save action
    const actionRepo = this.dataSource.getRepository(ActionMetadata);
    const createdAction = actionRepo.create(action);
    const newAction = await actionRepo.save(createdAction);

    // Fetch Admin Role
    const adminRole = await this.roleService.findRoleByName('Admin');

    // Generate menu
    const menu = {
        displayName: `${model.displayName}`,
        name: `${model.singularName}-menu-item`,
        sequenceNumber: 1,
        action: newAction,
        module: resolvedModule,
        roles: [adminRole],
        parentMenuItemUserKey: ""
    };

    // Save menu
    const menuRepo = this.dataSource.getRepository(MenuItemMetadata);
    const createdMenu = menuRepo.create(menu);
    await menuRepo.save(createdMenu);
    return `${removeFieldCodeOuput} \n ${refreshModelCodeOutput}`;
  }


  async generateRemoveFieldsCode(options: CodeGenerationOptions): Promise<string> {
    if (!options.modelId && !options.modelUserKey) {
      throw new BadRequestException('Model ID or Model Name is required for generating code');
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
        this.fieldMetadataService.remove(field.id);
      }
    });
    return removeOutput;
  }

  async generateModelCode(options: CodeGenerationOptions): Promise<string> {
    if (!options.modelId && !options.modelUserKey) {
      throw new BadRequestException('Model ID or Model Name is required for generating code');
    }

    const query = {
      populate: ["module", "fields"]
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


}
