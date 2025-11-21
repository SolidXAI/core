// Return the system fields metadata for a model

import { Injectable, Logger } from "@nestjs/common";
import { ModelMetadataRepository } from "src/repository/model-metadata.repository";
import { SolidRegistry } from "./solid-registry";
import { InjectRepository } from "@nestjs/typeorm";
import { ModelMetadata } from "src/entities/model-metadata.entity";
import { Repository } from "typeorm";

@Injectable()
export class ModelMetadataHelperService {
    private readonly logger = new Logger(ModelMetadataHelperService.name);

    constructor(private readonly registry: SolidRegistry,
        @InjectRepository(ModelMetadata)
        private readonly modelMetadataRepo: Repository<ModelMetadata>,
        // private readonly modelMetadataRepo: ModelMetadataRepository, //FIXME: circular dependency
    ) {
    }

    getSystemFieldsMetadata(): any[] {
        const systemFieldsMetadata = [
            {
                name: "id",
                displayName: "Id",
                type: "int",
                ormType: "bigint",
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
                ormType: "varchar",
                isSystem: true,
            },
            {
                name: "publishedAt",
                displayName: "Published At",
                type: "datetime",
                isSystem: true,
            },
            {
                name: "localeName",
                displayName: "Locale",
                type: "shortText",
                ormType: "varchar",
                isSystem: true,
            },
            {
                name: "defaultEntityLocaleId",
                displayName: "Default Entity Locale Id",
                type: "int",
                ormType: "integer",
                isSystem: true,
            },
            {
                name: "createdBy",
                displayName: "Created By",
                type: "relation",
                ormType: "integer",
                isSystem: true,
                relationType: "many-to-one",
                relationCoModelSingularName: "user",
                relationCreateInverse: false,
                relationCascade: "restrict",
                relationModelModuleName: "solid-core"
            },
            {
                name: "updatedBy",
                displayName: "Updated By",
                type: "relation",
                ormType: "integer",
                isSystem: true,
                relationType: "many-to-one",
                relationCoModelSingularName: "user",
                relationCreateInverse: false,
                relationCascade: "restrict",
                relationModelModuleName: "solid-core"
            },
        ]

        // Do an additional check and add a warning if the common entity keys and system field metadata keys don't match exactly
        const commonEntityKeys = this.registry.getCommonEntityKeys();
        const systemFieldNames = systemFieldsMetadata.map(field => field.name);
        const missingKeys = commonEntityKeys.filter(key => !systemFieldNames.includes(key));
        if (missingKeys.length > 0) {
            this.logger.warn(`Missing system fields metadata for common entity keys: ${missingKeys.join(', ')}`);
        }
        return systemFieldsMetadata;
    }

    async loadFieldHierarchy(modelName: any) {
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