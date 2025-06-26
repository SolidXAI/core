import { camelize } from "@angular-devkit/core/src/utils/strings";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { ComputedFieldMetadata, SolidRegistry } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";
import { ComputedFieldEvaluationPublisher } from "src/jobs/database/computed-field-evaluation-publisher.service";
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

// Create an interface i.e ComputedFieldEvaluationPayload which has same fields as the ComputedFieldMetadata and an additional field for the database entity
export interface ComputedFieldEvaluationPayload extends ComputedFieldMetadata {
    databaseEntity: any;
}

@Injectable()
@EventSubscriber()
export class ComputedEntityFieldSubscriber implements EntitySubscriberInterface {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry,
        private readonly computedFieldPublisher: ComputedFieldEvaluationPublisher,
    ) {
        this.dataSource.subscribers.push(this);
    }

    async beforeInsert(event: InsertEvent<any>): Promise<any> {
        await this.handleComputedFieldEvaluation(event.entity, ComputedFieldTriggerOperation.beforeInsert);
    }

    async beforeUpdate(event: UpdateEvent<any>): Promise<any>{
        await this.handleComputedFieldEvaluation(event.databaseEntity, ComputedFieldTriggerOperation.beforeUpdate);
    }

    async afterInsert(event: InsertEvent<any>) {
        await this.handleComputedFieldEvaluationJob(event.entity, ComputedFieldTriggerOperation.afterInsert);
    }

    async afterUpdate(event: UpdateEvent<any>) {
        await this.handleComputedFieldEvaluationJob(event.databaseEntity, ComputedFieldTriggerOperation.afterUpdate);
    }

    async afterRemove(event: any) {
        await this.handleComputedFieldEvaluationJob(event.databaseEntity, ComputedFieldTriggerOperation.afterRemove);
    }

    //FIXME: Need to add support for beforeRemmove, beforeSoftRemove, afterSoftRemove, beforeRecover, afterRecover

    private async handleComputedFieldEvaluation(entity: any, currentOperation: ComputedFieldTriggerOperation): Promise<void> {
        if (!entity) {
            return;
        }
        const currentModelName = camelize(entity.constructor.name); // Resolve the model name from the entity class name
        const computedFieldsTobeEvaluated = this.getComputedFieldsToBeEvaluated(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            currentModelName
        );
        for (const computedFieldMetadata of computedFieldsTobeEvaluated) {
            const computedValue = await this.getComputedValue(computedFieldMetadata, entity); //FIXME: There should some way to check/assert if the provider actually has a postComputeAndSaveValue
            entity[computedFieldMetadata.fieldName] = computedValue; // Set the computed value on the entity
        }
    }

    private async handleComputedFieldEvaluationJob(entity: any, currentOperation: ComputedFieldTriggerOperation): Promise<void> {
        if (!entity) {
            return;
        }
        const currentModelName = camelize(entity.constructor.name); //Resolve the model name from the entity class name
        const computedFieldsTobeEvaluated = this.getComputedFieldsToBeEvaluated(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            currentModelName
        );
        for (const computedField of computedFieldsTobeEvaluated) {
            this.enqueueComputedFieldEvaluationJob(computedField, entity);
        }
    }

    private async getComputedValue(computedFieldMetadata: ComputedFieldMetadata<any>, entity: any) {
        const provider = this.solidRegistry.getComputedFieldProvider(computedFieldMetadata.computedFieldValueProviderName);
        // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
        const providerInstance = provider.instance as IEntityPreComputeFieldProvider<any, any, any>; // IEntityComputedFieldProvider
        const computedValue = await providerInstance.preComputeValue(entity, computedFieldMetadata); //FIXME There should some way to check/assert if the provider actually has a postComputeAndSaveValue
        return computedValue;
    }

    private enqueueComputedFieldEvaluationJob(computedField: ComputedFieldMetadata<any>, databaseEntity: any) {
        const payload = {
            ...computedField,
            databaseEntity,
        };
        this.computedFieldPublisher.publish({
            payload
        });
    }

    // Based on the current model name and current operation, identify all the computed providers that need to be evaluated
    // Pass the database entity and the context to the provider of type IEntityComputedFieldProvider
    private getComputedFieldsToBeEvaluated(computedFieldMetadata: ComputedFieldMetadata[], currentOperation: ComputedFieldTriggerOperation, currentModelName: string) {
        return computedFieldMetadata.filter(
            (computedField) => computedField.computedFieldTriggerConfig.some(
                (trigger) => trigger.operations.includes(currentOperation) &&
                    trigger.modelName === currentModelName
            )
        );
    }
}