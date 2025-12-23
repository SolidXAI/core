import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { CrudHelperService } from "src/services/crud-helper.service";
import { CRUDService } from 'src/services/crud.service';
import { FileService } from "src/services/file.service";
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { EntityManager, In } from 'typeorm';


import { classify } from '@angular-devkit/core/src/utils/strings';
import { Locale } from 'src/entities/locale.entity';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { ViewMetadataRepository } from 'src/repository/view-metadata.repository';
import { UpdateViewMetadataDto } from '../dtos/update-view-metadata.dto';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { ViewMetadata } from '../entities/view-metadata.entity';
import { ActionMetadataService } from './action-metadata.service';
import { MenuItemMetadataService } from './menu-item-metadata.service';
import { SolidIntrospectService } from './solid-introspect.service';
import { UserViewMetadataService } from './user-view-metadata.service';

@Injectable()
export class ViewMetadataService extends CRUDService<ViewMetadata> {
  constructor(
    @Inject(forwardRef(() => ModelMetadataService))
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    readonly actionMetadataService: ActionMetadataService,
    readonly menuItemMetadataService: MenuItemMetadataService,
    readonly introspectService: SolidIntrospectService,
    readonly userViewMetadataService: UserViewMetadataService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ViewMetadata, 'default')
    readonly repo: ViewMetadataRepository,
    // @InjectRepository(FieldMetadata)
    // private readonly fieldMetadataRepo: Repository<FieldMetadata>,
    // @InjectRepository(ModelMetadata)
    // private readonly modelMetadataRepo: Repository<ModelMetadata>,
    @Inject(forwardRef(() => ModelMetadataRepository))
    private readonly modelMetadataRepo: ModelMetadataRepository,
    private readonly modelMetadataHelperService: ModelMetadataHelperService,
    readonly moduleRef: ModuleRef
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'viewMetadata', 'solid-core', moduleRef);
  }

  private readonly logger = new Logger(ViewMetadataService.name);

  //for locales 
  private async getEntityRecordsInAllLocales(
    modelName: string,
    id: string,
    defaultEntityLocaleIdFromQuery?: string
  ): Promise<{ records: any[], defaultEntityLocaleId: string | null }> {
    const solidRegistry = await this.moduleRef.get(SolidRegistry, { strict: false });
    // const currentEntityTarget = solidRegistry.getEntityTarget(this.entityManager, classify(modelName));
    const currentEntityRepository = this.entityManager.getRepository(classify(modelName));

    // Case 1: Creating a new record with no defaultEntityLocaleId to clone
    if (id === 'new' && !defaultEntityLocaleIdFromQuery) {
      this.logger.debug(`Creating new record without cloning from any defaultEntityLocaleId.`);
      return { records: [], defaultEntityLocaleId: null };
    }

    // Case 2: Creating a new record and cloning from an existing defaultEntityLocaleId
    if (id === 'new' && defaultEntityLocaleIdFromQuery) {
      this.logger.debug(`Creating new record by cloning translations from defaultEntityLocaleId: ${defaultEntityLocaleIdFromQuery}`);

      const records = await currentEntityRepository.find({
        where: [
          { defaultEntityLocaleId: defaultEntityLocaleIdFromQuery },
          { id: defaultEntityLocaleIdFromQuery }
        ]
      });

      this.logger.debug(`Found ${records.length} cloned records for new entity.`);
      return { records, defaultEntityLocaleId: defaultEntityLocaleIdFromQuery };
    }

    // Case 3: Editing an existing entity
    const entityRecord = await currentEntityRepository.findOne({ where: { id } });

    if (!entityRecord) {
      this.logger.warn(`No entity found for id ${id}`);
      return { records: [], defaultEntityLocaleId: null };
    }

    const defaultLocale = await this.entityManager.getRepository(Locale).findOne({ where: { isDefault: true } });

    let defaultEntityLocaleId: string;
    if (entityRecord.localeName === defaultLocale?.locale) {
      defaultEntityLocaleId = entityRecord.id;
      this.logger.debug(`Editing default locale record with id ${defaultEntityLocaleId}`);
    } else {
      defaultEntityLocaleId = entityRecord.defaultEntityLocaleId;
      this.logger.debug(`Editing non-default locale record. DefaultEntityLocaleId: ${defaultEntityLocaleId}`);
    }

    const records = await currentEntityRepository.find({
      where: [
        { defaultEntityLocaleId: defaultEntityLocaleId },
        { id: defaultEntityLocaleId }
      ]
    });

    this.logger.debug(`Found ${records.length} records in all locales for existing entity.`);

    return { records, defaultEntityLocaleId };
  }

  // START: Custom Service Methods
  async getLayout(query, activeUser) {
    let { modelName, moduleName, viewType, id, populate, menuItemId, menuItemName, actionId, actionName } = query;


    // 1. Fetch the action based on actionId.
    const solidRequestContext = {
      activeUser: activeUser
    }
    const actionQuery = {
      populate: ["view"]
    }
    let action = null;
    if (actionId) {
      action = await this.actionMetadataService.findOne(actionId, actionQuery, solidRequestContext);
    }

    // 2. Fetch the menu based on menuItemId.
    const menuItemQuery = {
    }
    let menuItem = null;
    if (menuItemId) {
      menuItem = await this.menuItemMetadataService.findOne(menuItemId, menuItemQuery, solidRequestContext);
    }
    const viewId = action?.view?.id
    // 3. Fetch the view based on module, model & view name.
    const entity = await this.repo.findOne({
      where: {
        model: { singularName: modelName },
        module: { name: moduleName },
        ...(actionId && viewId ? { id: action.view.id } : { type: viewType })
      },
      relations: {
        model: {
          userKeyField: true,
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

    // 4. add action and menuItem to Entity which is our solid View
    if (actionId) {
      delete action.view;
      entity['action'] = action
    }
    if (menuItemId) {
      entity['menu'] = menuItem
    }

    // 5. See if we have a user specific layout for this view.
    const userLayout = await this.userViewMetadataService.repo.findOne({
      where: {
        user: { id: activeUser?.sub },
        viewMetadata: { id: entity.id },
      },
    });
    // Based on where we found the layout we are converting it from string to json.
    if (userLayout) {
      entity.layout = JSON.parse(userLayout.layout);
    } else {
      entity.layout = JSON.parse(entity.layout);
    }


    // 6. We are resolving the create & edit actions if specified in the layout.
    if (entity?.layout?.attrs?.createAction) {
      const actionName: string = entity.layout.attrs.createAction;
      entity.layout.attrs.createAction = await this.actionMetadataService.findOneByUserKey(actionName)
    }
    if (entity?.layout?.attrs?.editAction) {
      const actionName: string = entity.layout.attrs.editAction;
      entity.layout.attrs.editAction = await this.actionMetadataService.findOneByUserKey(actionName)
    }

    // 7. For form views we need to fetch the workflow field metadata if specified.
    let workflowFieldName = null;
    let workflowField = null;
    if (viewType === 'form') {
      workflowFieldName = entity.layout?.attrs?.workflowField;
    }

    // 8. Create an easy to use map of field metadata, rather than sending an array of fields it becomes easier to use in the frontend.
    const fields = await this.modelMetadataHelperService.loadFieldHierarchy(modelName);
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

    // 9. Use the resolved workflowField to populate workflow specific metadata.
    // Check if we were able to resolve an actual workflowField.
    let solidFormViewWorkflowData = [];
    if (viewType === 'form' && workflowField) {
      // check for type of workflow field. 
      // for workflowFields of type selectionStatic we simply return the key/values from field metadata AS-IS
      if (workflowField.type === 'selectionStatic') {
        solidFormViewWorkflowData = workflowField.selectionStaticValues.map(item => {
          const [value, label] = item.split(":");
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

    // 10. If this model supports internationalisation, we need to load the locales applicable with the id of an actual record for each locale if present.
    // This is the shape of locales that will be returned 
    /**
     * [
     *    {locale: 'en', displayName: 'English', isDefault: 'yes', defaultEntityLocaleId: '', entityId: '1'}, 
     *    {locale: 'en-IN', displayName: 'English (India)', isDefault: 'no', defaultEntityLocaleId: '1', entityId: '2'}, 
     *    {locale: 'en-SG', displayName: 'English (Singapore)', isDefault: 'no', defaultEntityLocaleId: '', entityId: '3'}, 
     *    {locale: 'fr', displayName: 'French', isDefault: 'no', defaultEntityLocaleId: '', entityId: ''}
     * ]
     */

    const applicableLocales: any = []
    // if (entity.model.internationalisation) {
    //   const allLocales = await this.entityManager.getRepository(Locale).find({});

    //   if (id === 'new') {
    //     allLocales.forEach(locale => {
    //       applicableLocales.push({
    //         locale: locale.locale,
    //         displayName: locale.displayName,
    //         isDefault: locale.isDefault ? 'yes' : 'no',
    //         defaultEntityLocaleId: null,
    //         entityId: null
    //       });
    //     });
    //   }
    //   else {
    //     const defaultLocale = allLocales.find(locale => locale.isDefault);
    //     this.logger.debug(`Default locale is: ${defaultLocale.locale}`);

    //     // Get hold of the repository for the current model
    //     const solidRegistry = await this.moduleRef.get(SolidRegistry, { strict: false });
    //     const currentEntityTarget = solidRegistry.getEntityTarget(this.entityManager, classify(modelName));
    //     const currentEntityRepository = this.entityManager.getRepository(currentEntityTarget);

    //     // We are in edit mode, the id that is being edited could be a record tagged with the default locale or it could be tagged with a non-default locale.
    //     const entityRecord = await currentEntityRepository.findOne({
    //       where: {
    //         id: id,
    //       }
    //     });
    //     if(entityRecord){
    //     //  Resolve the default entity locale id....
    //       let defaultEntityLocaleId = null;
    //       if (entityRecord.localeName === defaultLocale.locale) {
    //         defaultEntityLocaleId = entityRecord.id;
    //         this.logger.debug(`You are editing a record tagged with the default locale: ${entityRecord.localeName}.`);
    //       }
    //       else {
    //         defaultEntityLocaleId = entityRecord.defaultEntityLocaleId;
    //         this.logger.debug(`You are editing a record tagged with the non-default locale: ${entityRecord.localeName}. `);
    //       }
    //       this.logger.debug(`Identified default Entity Locale Id: ${defaultEntityLocaleId}`);

    //       // Now we query for all records in the same model matching the defaultEntityLocaleId
    //       // Get all records mathcing the defaultEntityLocaleId or where the id is same as the defaultEntityLocaleId
    //       const entityRecordsInAllLocales = await currentEntityRepository.find({
    //         where: [
    //           { defaultEntityLocaleId: defaultEntityLocaleId },
    //           { id: defaultEntityLocaleId }
    //         ],
    //       });
    //       this.logger.debug(`Found ${entityRecordsInAllLocales.length} records in all locales for the defaultEntityLocaleId: ${defaultEntityLocaleId}`);

    //       // Loop over all locales and populate the applicableLocales array
    //       for (const locale of allLocales) {
    //         // Find the record in the entityRecordsInAllLocales that matches the current locale
    //         const matchingRecord = entityRecordsInAllLocales.find(record => record.localeName === locale.locale);

    //         applicableLocales.push({
    //           locale: locale.locale,
    //           displayName: locale.displayName,
    //           isDefault: locale.isDefault ? 'yes' : 'no',
    //           defaultEntityLocaleId: defaultEntityLocaleId,
    //           entityId: (matchingRecord ? matchingRecord.id : null)
    //         });
    //       }
    //     }else{
    //       this.logger.warn(`No record found for id: ${id} in model: ${modelName}. Cannot determine applicable locales.`);
    //     }
    //   }
    // }
    if (entity.model.internationalisation) {
      const defaultEntityLocaleIdFromQuery = query?.defaultEntityLocaleId;
      const { records: entityRecordsInAllLocales, defaultEntityLocaleId } =
        await this.getEntityRecordsInAllLocales(modelName, id, defaultEntityLocaleIdFromQuery);
      const allLocales = await this.entityManager.getRepository(Locale).find({});
      for (const locale of allLocales) {
        const matchingRecord = entityRecordsInAllLocales.find(record => record.localeName === locale.locale);
        applicableLocales.push({
          locale: locale.locale,
          displayName: locale.displayName,
          isDefault: locale.isDefault ? 'yes' : 'no',
          defaultEntityLocaleId: defaultEntityLocaleId,
          entityId: matchingRecord ? matchingRecord.id : null
        });
      }
    }

    const r = {
      'solidView': entity,
      'solidFieldsMetadata': Object.fromEntries(fieldsMap),
      'solidFormViewWorkflowData': solidFormViewWorkflowData,
      'applicableLocales': applicableLocales,
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
