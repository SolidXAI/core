import { classify } from "@angular-devkit/core/src/utils/strings";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { CommonEntity } from "src/entities/common.entity";
import { ModelSequence } from "src/entities/model-sequence.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPostComputeFieldProvider } from "src/interfaces";
import { DataSource } from "typeorm";


export interface EntityIdSequenceNumComputedFieldContext {
    sequenceName: string;
}

@ComputedFieldProvider()
@Injectable()
export class EntityIdSequenceNumComputedFieldProvider<T extends CommonEntity> implements IEntityPostComputeFieldProvider<T, EntityIdSequenceNumComputedFieldContext> {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource
    ) { }

    name(): string {
        return "EntityIdSequenceNumComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to create fields whose value is based on prefix, padding & the entity's own id. Intended for use in after-insert hooks only.";
    }

    async postComputeAndSaveValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<EntityIdSequenceNumComputedFieldContext>): Promise<void> {
        const eventType = computedFieldMetadata.eventContext?.eventType;
        if (eventType !== ComputedFieldTriggerOperation.afterInsert) {
            throw new Error(`EntityIdSequenceNumComputedFieldProvider only supports "${ComputedFieldTriggerOperation.afterInsert}" events, but received "${eventType}"`);
        }

        const { sequenceName } = computedFieldMetadata.computedFieldValueProviderCtxt ?? {};

        if (!sequenceName) {
            throw new Error("sequenceName is required for EntityIdSequenceNum computation");
        }

        const modelSequenceRepo = this.dataSource.manager.getRepository(ModelSequence);
        const modelSequence = await modelSequenceRepo.findOne({
            where: { sequenceName },
            relations: { model: true },
        });

        if (!modelSequence) {
            throw new Error(`ModelSequence not found for ${sequenceName}`);
        }

        const modelSingularName = modelSequence.model?.singularName;
        if (!modelSingularName) {
            throw new Error(`Model singularName not found for sequence ${sequenceName}`);
        }

        const padding = modelSequence.padding ?? 5;
        const prefix = modelSequence.prefix ?? "";
        const separator = modelSequence.separator ?? "";
        const paddedId = String(triggerEntity.id).padStart(padding, "0");
        const sequenceString = `${prefix}${separator}${paddedId}`;

        const entityName = classify(modelSingularName);
        const entityRepo = this.dataSource.manager.getRepository(entityName);
        await entityRepo.update(triggerEntity.id, { [computedFieldMetadata.fieldName]: sequenceString });
    }
}
