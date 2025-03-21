import { Injectable } from '@nestjs/common';
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
  async getLayout(query) {
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
    if (entity) {
      entity.layout = JSON.parse(entity.layout);
      if (entity?.layout?.attrs?.createAction) {
        const actionName: string = entity.layout.attrs.createAction;
        entity.layout.attrs.createAction = await this.actionMetadataService.findOneByUserKey(actionName)
      }
      if (entity?.layout?.attrs?.editAction) {
        const actionName: string = entity.layout.attrs.editAction;
        entity.layout.attrs.editAction = await this.actionMetadataService.findOneByUserKey(actionName)
      }
    }
    // We also need to fetch a map of fields.
    const fields = await this.fieldMetadataRepo.find({
      where: {
        model: {
          singularName: modelName,
        }
      }
    });
    const fieldsMap = new Map<string, FieldMetadata>();
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

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

    return {
      'solidView': entity,
      'solidFieldsMetadata': Object.fromEntries(fieldsMap),
    };
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
