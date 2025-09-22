import { camelize } from "@angular-devkit/core/src/utils/strings";
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { ComputedFieldMetadata, SolidRegistry } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";
import { PublisherFactory } from "src/services/queues/publisher-factory.service";
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

// Create an interface i.e ComputedFieldEvaluationPayload which has same fields as the ComputedFieldMetadata and an additional field for the database entity
export interface ComputedFieldEvaluationPayload extends ComputedFieldMetadata {
    databaseEntity: any;
}

@Injectable()
@EventSubscriber()
export class ComputedEntityFieldSubscriber implements EntitySubscriberInterface {
    private readonly logger = new Logger(this.constructor.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry,
        private readonly publisherFactory: PublisherFactory<ComputedFieldEvaluationPayload>
        // private readonly computedFieldPublisher: ComputedFieldEvaluationPublisherDatabase,
    ) {
        this.dataSource.subscribers.push(this);
    }

    async beforeInsert(event: InsertEvent<any>): Promise<any> {
        await this.handleComputedFieldEvaluation(event.entity, ComputedFieldTriggerOperation.beforeInsert);
    }

    async beforeUpdate(event: UpdateEvent<any>): Promise<any> {
        await this.handleComputedFieldEvaluation(event.databaseEntity, ComputedFieldTriggerOperation.beforeUpdate);
    }

    afterInsert(event: InsertEvent<any>) {
        this.handleComputedFieldEvaluationJob(event.entity, ComputedFieldTriggerOperation.afterInsert);
    }

    afterUpdate(event: UpdateEvent<any>) {
        this.handleComputedFieldEvaluationJob(event.databaseEntity, ComputedFieldTriggerOperation.afterUpdate);
    }

    afterRemove(event: any) {
        this.handleComputedFieldEvaluationJob(event.databaseEntity, ComputedFieldTriggerOperation.afterRemove);
    }

    //FIXME: Need to add support for beforeRemove, beforeSoftRemove, afterSoftRemove, beforeRecover, afterRecover

    private async handleComputedFieldEvaluation(entity: any, currentOperation: ComputedFieldTriggerOperation): Promise<void> {
        if (!entity) {
            return;
        }
        const computedFieldsTobeEvaluated = this.getComputedFieldsForEvaluation(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            camelize(entity.constructor.name)
        );
        //TODO: We can add a feature i.e dependsOn, where we can check if the computed field depends on other computed fields and evaluate them first
        await Promise.all(
            computedFieldsTobeEvaluated.map(c => this.evaluateComputedField(c, entity))
        )
    }

    private handleComputedFieldEvaluationJob(entity: any, currentOperation: ComputedFieldTriggerOperation) {
        if (!entity) {
            return;
        }
        const computedFieldsTobeEvaluated = this.getComputedFieldsForEvaluation(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            camelize(entity.constructor.name)
        );
        //TODO: We can add a feature i.e dependsOn, where we can check if the computed field depends on other computed fields and evaluate them first
        for (const computedField of computedFieldsTobeEvaluated) {
            this.enqueueComputedFieldEvaluationJob(computedField, entity);
        }
    }

    // Based on the current model name and current operation, identify all the computed providers that need to be evaluated
    // Pass the database entity and the context to the provider of type IEntityComputedFieldProvider
    private getComputedFieldsForEvaluation(computedFieldMetadata: ComputedFieldMetadata[] = [], currentOperation: ComputedFieldTriggerOperation, currentModelName: string) {
        return computedFieldMetadata.filter(
            (computedField) => computedField.computedFieldTriggerConfig.some(
                (trigger) => trigger.operations.includes(currentOperation) &&
                    trigger.modelName === currentModelName
            )
        );
    }

    private async evaluateComputedField(computedFieldMetadata: ComputedFieldMetadata<any>, entity: any) {
        const computedValue = await this.preComputeValue(computedFieldMetadata, entity);
        if (computedValue) {
            entity[computedFieldMetadata.fieldName] = computedValue; //TODO: This line here is just for backward compatibility, once the pre compute interface is change to return void, we will get rid of it.
        }
    }

    private async preComputeValue(computedFieldMetadata: ComputedFieldMetadata<any>, entity: any) {
        try {
            const provider = this.solidRegistry.getComputedFieldProvider(computedFieldMetadata.computedFieldValueProviderName);
            // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
            const providerInstance = provider.instance as IEntityPreComputeFieldProvider<any, any, any>; // IEntityComputedFieldProvider
            const computedValue = await providerInstance.preComputeValue(entity, computedFieldMetadata); //FIXME There should some way to check/assert if the provider actually has a postComputeAndSaveValue
            return computedValue; //TODO: This line here is just for backward compatibility, once the pre compute interface is change to return void, we will get rid of it.
        } catch (error) {
            throw new InternalServerErrorException(`Error evaluating computed field ${computedFieldMetadata.fieldName} for model ${computedFieldMetadata.modelName} for triggered entity ${entity.constructor.name}: ${error.message}`);
        }
    }

    private enqueueComputedFieldEvaluationJob(computedField: ComputedFieldMetadata<any>, databaseEntity: any) {
        const payload = {
            ...computedField,
            databaseEntity,
        };
        this.publisherFactory.publish({payload}, 'ComputedFieldEvaluationPublisher')
        // this.computedFieldPublisher.publish({
        //     payload
        // });
    }

}