import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { CommonEntity } from "src/entities/common.entity";
import { ModelSequence } from "src/entities/model-sequence.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPostComputeFieldProvider } from "src/interfaces";
import { DataSource, EntityManager } from "typeorm";


export interface SequenceNumComputedFieldContext {
    sequenceName: string; // The separator to use between concatenated values
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
        return "Computed field provider used to create fields whose value is based on some prefix, padding & sequence number.";
    }

    private async generateSequenceValue(sequenceName: string, manager?: EntityManager): Promise<{ sequenceString: string; currentValue: number }> {
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
            const paddedValue = String(nextValue).padStart(modelSequence.padding ?? 5, "0");
            const prefix = modelSequence.prefix ?? "";
            const separator = modelSequence.separator ?? "";
            const sequenceString = `${prefix}${separator}${paddedValue}`;

            modelSequence.currentValue = nextValue;
            await modelSequenceRepo.save(modelSequence);

            return { sequenceString, currentValue: nextValue };
        };

        return manager ? run(manager) : this.dataSource.transaction(run);
    }

    async postComputeAndSaveValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<SequenceNumComputedFieldContext>): Promise<void> {
        const { sequenceName } = computedFieldMetadata.computedFieldValueProviderCtxt ?? {};

        if (!sequenceName) {
            throw new Error("sequenceName is required for sequence computation");
        }

        const { sequenceString } = await this.generateSequenceValue(sequenceName);

        // Update the entity with the computed field value. update is preferred to avoid the post update hooks getting triggered again and causing an infinite loop
        await this.dataSource.manager.update(triggerEntity.constructor, triggerEntity.id, { [computedFieldMetadata.fieldName]: sequenceString });
    }

}