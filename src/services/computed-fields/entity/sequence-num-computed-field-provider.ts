import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { CommonEntity } from "src/entities/common.entity";
import { ModelSequence } from "src/entities/model-sequence.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";
import { DataSource, EntityManager } from "typeorm";


export interface SequenceNumComputedFieldContext {
    sequenceName: string; // The separator to use between concatenated values
}

@ComputedFieldProvider()
@Injectable()
export class SequenceNumComputedFieldProvider<T extends CommonEntity> implements IEntityPreComputeFieldProvider<T, SequenceNumComputedFieldContext> {
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

    async preComputeValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<SequenceNumComputedFieldContext>) {
        const { sequenceName } =
            computedFieldMetadata.computedFieldValueProviderCtxt ?? {};

        if (!sequenceName) {
            throw new Error("sequenceName is required for sequence computation");
        }

        const contextManager = computedFieldMetadata.eventContext?.manager;

        const compute = async (manager: EntityManager) => {
            // Lock sequence row to avoid duplicate sequence numbers under concurrency.
            const modelSequenceRepo = manager.getRepository(ModelSequence)
            const modelSequence = await modelSequenceRepo.findOne({
                where: { sequenceName },
                lock: { mode: "pessimistic_write" }
            });

            if (!modelSequence) {
                throw new Error(`ModelSequence not found for ${sequenceName}`);
            }

            // 2️⃣ Generate next sequence value
            const nextValue = modelSequence.currentValue + 1;

            const paddedValue = String(nextValue).padStart(modelSequence.padding ?? 5, "0");

            const prefix = modelSequence.prefix ?? "";
            const separator = modelSequence.separator ?? "";

            const sequenceString = `${prefix}${separator}${paddedValue}`;

            // Set the computed field on the trigger entity.
            (triggerEntity as any)[computedFieldMetadata.fieldName] = sequenceString;

            // Persist updated sequence current value.
            modelSequence.currentValue = nextValue;
            await modelSequenceRepo.save(modelSequence);
        };

        if (contextManager?.queryRunner?.isTransactionActive) {
            await compute(contextManager);
            return;
        }

        await this.dataSource.transaction(async (manager) => {
            await compute(manager);
        });
    }

}
