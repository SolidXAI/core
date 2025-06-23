import { camelize } from "@angular-devkit/core/src/utils/strings";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { ComputedFieldMetadata, SolidRegistry } from "src/helpers/solid-registry";
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

    async afterInsert(event: InsertEvent<any>) {
        await this.computeValue(event.entity, ComputedFieldTriggerOperation.create);
    }

    async afterUpdate(event: UpdateEvent<any>) {
        await this.computeValue(event.databaseEntity, ComputedFieldTriggerOperation.update);
    }

    async afterRemove(event: any) {
        await this.computeValue(event.databaseEntity, ComputedFieldTriggerOperation.delete);
    }

    private async computeValue(databaseEntity: any, currentOperation: ComputedFieldTriggerOperation): Promise<void> {
        if (!databaseEntity) {
            return;
        }
        const currentModelName = camelize(databaseEntity.constructor.name); //Resolve the model name from the entity class name
        const computedFieldsTobeEvaluated = this.getComputedFieldsToBeEvaluated(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            currentModelName
        );
        this.evaluateComputedFieldProviders(computedFieldsTobeEvaluated, databaseEntity);
    }

    // Invoke the computeValue method of each computed field provider
    // Pass the database entity and the context to the provider of type IEntityComputedFieldProvider
    private async evaluateComputedFieldProviders(computedFieldsTobeEvaluated: ComputedFieldMetadata[], databaseEntity: any) {
        for (const computedField of computedFieldsTobeEvaluated) {
            const payload = {
                ...computedField,
                databaseEntity,
            }
            this.computedFieldPublisher.publish({
                payload
            });
        }
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