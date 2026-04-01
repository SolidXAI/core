import { classify } from "@angular-devkit/core/src/utils/strings";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { CommonEntity } from "src/entities/common.entity";
import { ModelSequence } from "src/entities/model-sequence.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPostComputeFieldProvider } from "src/interfaces";
import { DataSource, EntityManager } from "typeorm";


export interface SequenceNumComputedFieldContext {
    sequenceName: string;
    /**
     * - `'counter'` (default): increments the sequence's `currentValue` and uses it as the number.
     * - `'entityId'`: uses the entity's own `id` as the number; does not update the counter.
     *   Only valid on `afterInsert` events.
     */
    mode?: 'counter' | 'entityId';
}

@ComputedFieldProvider()
@Injectable()
export class SequenceNumComputedFieldProvider<T extends CommonEntity> implements IEntityPostComputeFieldProvider<T, SequenceNumComputedFieldContext> {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource
    ) { }

    name(): string {
        return "SequenceNumComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to create fields whose value is based on some prefix, padding & sequence number. " +
            "Use mode='counter' (default) to auto-increment the sequence's currentValue. " +
            "Use mode='entityId' to use the entity's own id as the number (afterInsert only, does not update the counter).";
    }

    private buildSequenceString(modelSequence: ModelSequence, numericValue: number): string {
        const prefix = modelSequence.prefix ?? "";
        const separator = modelSequence.separator ?? "";
        const padded = String(numericValue).padStart(modelSequence.padding ?? 5, "0");
        return `${prefix}${separator}${padded}`;
    }

    private async generateCounterSequenceValue(sequenceName: string, manager?: EntityManager): Promise<{ sequenceString: string; currentValue: number; modelSingularName: string }> {
        const run = async (mgr: EntityManager) => {
            const modelSequenceRepo = mgr.getRepository(ModelSequence);
            const modelSequence = await modelSequenceRepo.findOne({
                where: { sequenceName },
                lock: { mode: "pessimistic_write" }
            });

            if (!modelSequence) {
                throw new Error(`ModelSequence not found for ${sequenceName}`);
            }

            const nextValue = modelSequence.currentValue + 1;
            const sequenceString = this.buildSequenceString(modelSequence, nextValue);

            modelSequence.currentValue = nextValue;
            await modelSequenceRepo.save(modelSequence);

            // Load model relation in a separate query to avoid FOR UPDATE on joined relation.
            const modelSequenceWithModel = await modelSequenceRepo.findOne({
                where: { id: modelSequence.id },
                relations: { model: true },
            });
            const modelSingularName = modelSequenceWithModel?.model?.singularName;
            if (!modelSingularName) {
                throw new Error(`Model singularName not found for sequence ${sequenceName}`);
            }

            return { sequenceString, currentValue: nextValue, modelSingularName };
        };

        return manager ? run(manager) : this.dataSource.transaction(run);
    }

    private async generateEntityIdSequenceValue(sequenceName: string, entityId: number): Promise<{ sequenceString: string; modelSingularName: string }> {
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

        return { sequenceString: this.buildSequenceString(modelSequence, entityId), modelSingularName };
    }

    async postComputeAndSaveValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<SequenceNumComputedFieldContext>): Promise<void> {
        const { sequenceName, mode = 'counter' } = computedFieldMetadata.computedFieldValueProviderCtxt ?? {};

        if (!sequenceName) {
            throw new Error("sequenceName is required for sequence computation");
        }

        let sequenceString: string;
        let modelSingularName: string;

        if (mode === 'entityId') {
            const eventType = computedFieldMetadata.eventContext?.eventType;
            if (eventType !== ComputedFieldTriggerOperation.afterInsert) {
                throw new Error(`SequenceNumComputedFieldProvider with mode='entityId' only supports "${ComputedFieldTriggerOperation.afterInsert}" events, but received "${eventType}"`);
            }
            ({ sequenceString, modelSingularName } = await this.generateEntityIdSequenceValue(sequenceName, triggerEntity.id));
        } else {
            ({ sequenceString, modelSingularName } = await this.generateCounterSequenceValue(sequenceName));
        }

        const entityName = classify(modelSingularName);
        const entityRepo = this.dataSource.manager.getRepository(entityName);
        await entityRepo.update(triggerEntity.id, { [computedFieldMetadata.fieldName]: sequenceString });
    }
}
