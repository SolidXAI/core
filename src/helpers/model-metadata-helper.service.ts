// Return the system fields metadata for a model

import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { _ } from "lodash";
import { LEGACY_TABLE_FIELDS_PREFIX } from "src/entities/legacy-common.entity-with-existing-id.entity";
import { LegacyTableType } from "src/enums/legacy-table-type.enum";
import { ModelMetadata } from "src/entities/model-metadata.entity";
import { ModelMetadataRepository } from "src/repository/model-metadata.repository";
import { SolidRegistry } from "./solid-registry";
import { EntityManager } from "typeorm";

@Injectable()
export class ModelMetadataHelperService {
    private readonly logger = new Logger(ModelMetadataHelperService.name);

    constructor(
        private readonly registry: SolidRegistry,
        // @InjectRepository(ModelMetadata)
        // private readonly modelMetadataRepo: Repository<ModelMetadata>,
        @Inject(forwardRef(() => ModelMetadataRepository))
        private readonly modelMetadataRepo: ModelMetadataRepository,
    ) {
    }

    getSystemFieldsMetadata(legacyTableType: LegacyTableType = LegacyTableType.NONE): any[] {
        let systemFieldsMetadata: any[];
        if (legacyTableType === LegacyTableType.GENERATED_ID) {
            systemFieldsMetadata = this.getSystemFieldsMetadataMappingForLegacyTable(true);
        }
        else if (legacyTableType === LegacyTableType.EXISTING_ID) {
            systemFieldsMetadata = this.getSystemFieldsMetadataMappingForLegacyTable(false);
        }
        else {
            systemFieldsMetadata = this.getSystemFieldsMetadataMapping();
        }

        this.checkWithRegistry(systemFieldsMetadata);

        return systemFieldsMetadata;
    }

    // TODO: Do an additional check and add a warning if the common entity keys and system field metadata keys don't match exactly
    // Ideally this should be reflection based code
    private checkWithRegistry(systemFieldsMetadata: ({ name: string; displayName: string; type: string; ormType: string; isSystem: boolean; relationType?: undefined; relationCoModelSingularName?: undefined; relationCreateInverse?: undefined; relationCascade?: undefined; relationModelModuleName?: undefined; } | { name: string; displayName: string; type: string; isSystem: boolean; ormType?: undefined; relationType?: undefined; relationCoModelSingularName?: undefined; relationCreateInverse?: undefined; relationCascade?: undefined; relationModelModuleName?: undefined; } | { name: string; displayName: string; type: string; ormType: string; isSystem: boolean; relationType: string; relationCoModelSingularName: string; relationCreateInverse: boolean; relationCascade: string; relationModelModuleName: string; })[]) {
        const commonEntityKeys = this.registry.getCommonEntityKeys();
        const systemFieldNames = systemFieldsMetadata.map(field => field.name);
        const missingKeys = commonEntityKeys.filter(key => !systemFieldNames.includes(key));
        if (missingKeys.length > 0) {
            this.logger.warn(`Missing system fields metadata for common entity keys: ${missingKeys.join(', ')}`);
        }
    }

    private getSystemFieldsMetadataMapping() {
        return [
            {
                name: "id",
                displayName: "Id",
                type: "int",
                isSystem: true,
            },
            {
                name: "createdAt",
                displayName: "Created At",
                type: "datetime",
                isSystem: true,
            },
            {
                name: "updatedAt",
                displayName: "Updated At",
                type: "datetime",
                isSystem: true,
            },
            {
                name: "deletedAt",
                displayName: "Deleted At",
                type: "datetime",
                isSystem: true,
            },
            {
                name: "deletedTracker",
                displayName: "Deleted Tracker",
                type: "shortText",
                isSystem: true,
            },
            {
                name: "publishedAt",
                displayName: "Published At",
                type: "datetime",
                isSystem: true,
                enableAuditTracking:true
            },
            {
                name: "localeName",
                displayName: "Locale",
                type: "shortText",
                isSystem: true,
            },
            {
                name: "defaultEntityLocaleId",
                displayName: "Default Entity Locale Id",
                type: "int",
                isSystem: true,
            },
            {
                name: "createdBy",
                displayName: "Created By",
                type: "int",
                isSystem: true,
                columnName: "created_by_id",
            },
            {
                name: "updatedBy",
                displayName: "Updated By",
                type: "int",
                isSystem: true,
                columnName: "updated_by_id",
            }
        ];
    }

    private getSystemFieldsMetadataMappingForLegacyTable(withId: boolean=true) {
        const systemFieldsMetadata = this.getSystemFieldsMetadataMapping();
        if (!withId) {
            // Remove the id field metadata
            const index = systemFieldsMetadata.findIndex(field => field.name === 'id');
            if (index !== -1) {
                systemFieldsMetadata.splice(index, 1);
            }
        }

        // For legacy table, system fields, remove the ormType atribute from the metadata
        // systemFieldsMetadata.forEach(field => {
        //     delete field.ormType;
        // });

        // Except for createdBy and updatedBy fields, for which we need to keep the columnName as created_by_id and updated_by_id respectively,
        // we need to add a columnName attribute with legacy prefix concatenated with the kebab cased field name of the system field
        systemFieldsMetadata.forEach(field => {
            if (field.name === 'createdBy' || field.name === 'updatedBy') {
                field['columnName'] = `${LEGACY_TABLE_FIELDS_PREFIX}_${_.snakeCase(field.name)}_id`;
            } else {
                field['columnName'] = `${LEGACY_TABLE_FIELDS_PREFIX}_${_.snakeCase(field.name)}`;
            }
        });
        return systemFieldsMetadata;
    }

    async loadFieldHierarchy(modelName: any, manager?: EntityManager) {
        const repo = manager
            ? manager.getRepository(ModelMetadata)
            : this.modelMetadataRepo;
        const model = await repo.findOne({
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
        const fields: any[] = [];
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
}