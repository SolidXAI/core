import { camelize } from "@angular-devkit/core/src/utils/strings";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { ComputedFieldMetadata, SolidRegistry } from "src/helpers/solid-registry";
import { IEntityComputedFieldProvider } from "src/interfaces";
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
@EventSubscriber()
export class ComputedEntityFieldSubscriber implements EntitySubscriberInterface {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly solidRegistry: SolidRegistry
    ) {
        this.dataSource.subscribers.push(this);
    }

    async beforeInsert(event: InsertEvent<any>) {
        await this.computeValue(event.entity, ComputedFieldTriggerOperation.create);
    }

    async beforeUpdate(event: UpdateEvent<any>) {
        await this.computeValue(event.databaseEntity, ComputedFieldTriggerOperation.update);
    }

    async beforeRemove(event: any) {
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
        await this.evaluateComputedFieldProviders(computedFieldsTobeEvaluated, databaseEntity);
    }

    // Invoke the computeValue method of each computed field provider
    // Pass the database entity and the context to the provider of type IEntityComputedFieldProvider
    private async evaluateComputedFieldProviders(computedFieldsTobeEvaluated: ComputedFieldMetadata[], databaseEntity: any) {
        for (const computedField of computedFieldsTobeEvaluated) {
            const provider = computedField.computedFieldValueProvider;

            // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
            const providerInstance = provider.instance as IEntityComputedFieldProvider<any, any>; // IEntityComputedFieldProvider

            // FIXME:  await or not, needs to be determined if the computed field has been configured as sync or async
            await providerInstance.computeValue(databaseEntity, computedField.computedFieldValueProviderCtxt);
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

    // De-duplicate the computed field providers present for a computed field and get the unique list of computed field providers, based on the provider name
    // This is needed because multiple computed fields can have the same provider
    // We can create a set of InstanceWrapper of the provider and then use that to get the unique providers  
    // private getComputedFieldProviderMap(currentOperation: ComputedFieldTriggerOperation, currentModelName: string) {
    //     const computedFieldMetadata = this.solidRegistry.getComputedFieldMetadata();
    //     const computedFieldsTobeEvaluated = this.getComputedFieldsToBeEvaluated(computedFieldMetadata, currentOperation, currentModelName);
    //     return this.mapByComputedFieldProvider(computedFieldsTobeEvaluated);
    // }

    // Normalize and create a map by computed provider name within the computedFieldsTobeEvaluated array, to ensure that each computed field provider is unique
    // This is needed because multiple computed fields can have the same provider, and we want to run the computeValue method of each provider only once
    // We can create a map of InstanceWrapper of the provider and then use that to get
    // the unique providers, which will be used to invoke the computeValue method of each provider
    // private mapByComputedFieldProvider(computedFieldsTobeEvaluated: ComputedFieldMetadata[]) {
    //     const computedFieldProviderMap: Map<string, ComputedFieldMetadata[]> = new Map();
    //     for (const computedField of computedFieldsTobeEvaluated) {
    //         const providerName = computedField.computedFieldValueProvider.name;
    //         if (!computedFieldProviderMap.has(providerName)) {
    //             computedFieldProviderMap.set(providerName, []);
    //         }
    //         computedFieldProviderMap.get(providerName)?.push(computedField);
    //     }
    // }
}