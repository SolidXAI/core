import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { CrudHelperService } from "src/services/crud-helper.service";
import { CRUDService } from 'src/services/crud.service';
import { FileService } from "src/services/file.service";
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { EntityManager, Repository } from 'typeorm';


import { UpdateViewMetadataDto } from '../dtos/update-view-metadata.dto';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { ViewMetadata } from '../entities/view-metadata.entity';
import { ActionMetadataService } from './action-metadata.service';
import { SolidIntrospectService } from './solid-introspect.service';
import { BasicFilterDto } from 'src/dtos/basic-filters.dto';
import { UserViewMetadataService } from './user-view-metadata.service';

@Injectable()
export class ViewMetadataService extends CRUDService<ViewMetadata> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    readonly actionMetadataService: ActionMetadataService,
    readonly introspectService: SolidIntrospectService,
    readonly userViewMetadataService: UserViewMetadataService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ViewMetadata, 'default')
    readonly repo: Repository<ViewMetadata>,
    @InjectRepository(FieldMetadata)
    private readonly fieldMetadataRepo: Repository<FieldMetadata>,
    @InjectRepository(ModelMetadata)
    private readonly modelMetadataRepo: Repository<ModelMetadata>,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'viewMetadata', 'app-builder', moduleRef);
  }

  // START: Custom Service Methods
  async getLayout(query, activeUser) {
    let { modelName, moduleName, viewType, populate } = query;

    // modelName = camelize(modelName);

    // Fetch the view based on module, model & view name.
    const entity = await this.repo.findOne({
      where: {
        model: { singularName: modelName },
        module: { name: moduleName },
        type: viewType,
      },
      relations: {
        model: {
          userKeyField: true,  // Nested population of 'someOtherEntity' within 'model'
        },
        module: true,
      }
    });

    if (!entity) {
      throw new BadRequestException(`Unable to identify view for module: ${moduleName}, model: ${modelName} and viewType: ${viewType}`);
    }

    if (!activeUser?.sub) {
      throw new BadRequestException(`Unable to identify user for module: ${moduleName}, model: ${modelName} and viewType: ${viewType}`);
    }

    const userLayout = await this.userViewMetadataService.repo.findOne({
      where: {
        user: { id: activeUser?.sub },
        viewMetadata: { id: entity.id },
      },
    });


    if (userLayout) {
      entity.layout = JSON.parse(userLayout.layout);
    } else {
      entity.layout = JSON.parse(entity.layout);
    }


    // If view entity found then convert layout from "string" to "json".
    //pass user id 
    if (entity?.layout?.attrs?.createAction) {
      const actionName: string = entity.layout.attrs.createAction;
      entity.layout.attrs.createAction = await this.actionMetadataService.findOneByUserKey(actionName)
    }
    if (entity?.layout?.attrs?.editAction) {
      const actionName: string = entity.layout.attrs.editAction;
      entity.layout.attrs.editAction = await this.actionMetadataService.findOneByUserKey(actionName)
    }

    // for form views, we need to check if "workflow" field is configured, if configured then return an extra metadata "solidFormViewWorkflowData"
    let workflowFieldName = null;
    let workflowField = null;
    if (viewType === 'form') {
      workflowFieldName = entity.layout?.attrs?.workflowField;
    }

    // We also need to fetch a map of fields.
    const fields = await this.loadFieldHierarchy(modelName);
    const fieldsMap = new Map<string, FieldMetadata>();
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      // We need to identify the workflowField metadata if specified. 
      if (workflowFieldName && field.name === workflowFieldName) {
        workflowField = field;
      }

      // For fields of type relation & relationType many-to-one
      // We fetch metadata regarding the relationCoModelSingularName
      if (field.type === 'relation') {
        const relationModel = await this.modelMetadataRepo.find({
          where: {
            singularName: field.relationCoModelSingularName
          },
          relations: {
            userKeyField: true
          }
        });

        if (relationModel) {
          field['relationModel'] = relationModel[0];
        }
      }
      if (!fieldsMap.has(field.name)) {
        fieldsMap.set(field.name, field);
      }
    }

    // Check if we were able to resolve an actual workflowField.
    let solidFormViewWorkflowData = [];
    if (viewType === 'form' && workflowField) {
      // check for type of workflow field. 
      // for workflowFields of type selectionStatic we simply return the key/values from field metadata AS-IS
      if (workflowField.type === 'selectionStatic') {
        solidFormViewWorkflowData = workflowField.selectionStaticValues.map(item => {
          const [value,label] = item.split(":");
          return { label, value };
        });
      }
      // for workflowFields of type relation.many-to-one we need to query the co-model, and return data in key/value format.
      if (workflowField.type === 'relation' && workflowField.relationType === 'many-to-one') {
        const comodelCrudService = this.introspectService.getCRUDService(workflowField.relationCoModelSingularName);
        const data = await comodelCrudService.find({ limit: 100, offset: 0, });
        const records = data.records ?? [];
        const workflowFieldMetadata = fieldsMap.get(workflowFieldName);
        const workflowFielUserkey = workflowFieldMetadata['relationModel']['userKeyField']['name'];

        // iterate over the comodel records extracting the label & value. 
        solidFormViewWorkflowData = records.map(item => ({ 'label': item[workflowFielUserkey], 'value': item['id'] }))
      }

    }

    const r = {
      'solidView': entity,
      'solidFieldsMetadata': Object.fromEntries(fieldsMap),
      'solidFormViewWorkflowData': solidFormViewWorkflowData
    }

    return r;
  }

  private async loadFieldHierarchy(modelName: any) {
    const model = await this.modelMetadataRepo.findOne({
      where: {
        singularName: modelName,
      },
      relations: {
        fields: true,
        parentModel: {
          fields: true,
        }
      }
    });
    const fields = [];
    if (model) {
      // Add the fields of the current model
      fields.push(...model.fields);

      // Add the fields of the parent model
      if (model.parentModel) {
        fields.push(...model.parentModel.fields);
      }
    }
    return fields;        
  }

  async findOneByUserKey(name: string, relations = {}) {
    const entity = await this.repo.findOne({
      where: {
        name: name,
      },
      relations: relations,
    });
    return entity;
  }

  async upsert(updateSolidViewDto: UpdateViewMetadataDto) {
    // First check if module already exists using name
    const existingSolidView = await this.findOneByUserKey(updateSolidViewDto.name);

    // if found
    if (existingSolidView) {
      const updatedSolidViewDto = { ...existingSolidView, ...updateSolidViewDto };
      return this.repo.save(updatedSolidViewDto);
    }
    // if not found - create new 
    else {
      const viewData = this.repo.create(updateSolidViewDto);
      return this.repo.save(viewData);
    }
  }

  async createIfNotPresent(updateSolidViewDto: UpdateViewMetadataDto) {
    // First check if module already exists using name
    const existingSolidView = await this.findOneByUserKey(updateSolidViewDto.name);

    // if found
    if (existingSolidView) {
    }
    // if not found - create new 
    else {
      const viewData = this.repo.create(updateSolidViewDto);
      return this.repo.save(viewData);
    }
  }

  // END: Custom Service Methods

}
