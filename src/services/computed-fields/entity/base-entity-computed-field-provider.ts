import { classify } from "@angular-devkit/core/src/utils/strings";
import { Logger } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { CommonEntity } from "src/entities/common.entity";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityComputedFieldProvider } from "src/interfaces";
import { EntityManager } from "typeorm";

export abstract class BaseEntityComputedFieldProvider<TTriggerEntity extends CommonEntity, TContext, TValue> implements IEntityComputedFieldProvider<TTriggerEntity, TContext> {
    constructor(
        @InjectEntityManager()
        protected readonly entityManager: EntityManager
    ) { }

    protected readonly logger = new Logger(this.constructor.name);

    abstract name(): string;

    abstract help(): string;

    abstract computeValue(entity: TTriggerEntity, computedFieldContext: TContext): Promise<TValue>;

    async computeAndSaveValue(triggerEntity: TTriggerEntity, computedFieldMetadata: ComputedFieldMetadata<TContext>): Promise<void> {
        // Validate the input parameters
        this.validate(triggerEntity, computedFieldMetadata);

        // Extract the required metadata fields
        const { computedFieldValueProviderCtxt, fieldName } = computedFieldMetadata;

        // Call the computeValue method to compute the value
        const computedValue = await this.computeValue(triggerEntity, computedFieldValueProviderCtxt);

        // Update the computed field model entity with the computed value
        await this.saveComputedFieldValue(computedFieldMetadata, triggerEntity, fieldName, computedValue);
    }

    private async saveComputedFieldValue(computedFieldMetadata: ComputedFieldMetadata<TContext>, triggerEntity: TTriggerEntity, fieldName: string, computedValue: Awaited<TValue>) {
        const entityName = classify(computedFieldMetadata.modelName);
        const result = await this.entityManager.update(entityName, { id: triggerEntity.id }, {
            [fieldName]: computedValue,
        });

        // Below are logged as debugs, because not all db drivers support the affected rows count
        if (result.affected === 0) {
            this.logger.debug(`No entity found with id ${triggerEntity.id} to update.`);
        } else {
            this.logger.debug(`Entity with id ${triggerEntity.id} updated successfully with concatenated value: ${computedValue}`);
        }
    }

    private validate(triggerEntity: TTriggerEntity, computedFieldMetadata: ComputedFieldMetadata<TContext>) {
        if (!triggerEntity || !computedFieldMetadata) {
            throw new Error(`Missing entity or computed field metadata for computation provider ${this.constructor.name}`);
        }
        const fieldName = computedFieldMetadata.fieldName; // The name of the computed field to set
        if (!fieldName) {
            throw new Error(`Computed field metadata must have a fieldName property for provider ${this.constructor.name}`);
        }
    }
}