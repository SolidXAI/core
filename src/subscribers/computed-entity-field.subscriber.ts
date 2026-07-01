import { camelCase } from 'lodash';
import { forwardRef, Inject, Injectable, InternalServerErrorException, Logger, Scope } from "@nestjs/common";
import { ComputedFieldTriggerOperation } from "src/dtos/create-field-metadata.dto";
import { isEmbeddedDb } from "src/helpers/environment.helper";
import { ComputedFieldMetadata, SolidRegistry, TypeOrmEventContext } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";
import { PublisherFactory } from "src/services/queues/publisher-factory.service";
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from "typeorm";

// Create an interface i.e ComputedFieldEvaluationPayload which has same fields as the ComputedFieldMetadata and an additional field for the database entity
export interface ComputedFieldEvaluationPayload extends ComputedFieldMetadata {
    databaseEntity: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class ComputedEntityFieldSubscriber implements EntitySubscriberInterface {
    private readonly logger = new Logger(this.constructor.name);
    private dataSource: DataSource;

    // Per-transaction buffer for post-event evaluation jobs. Entries are
    // flushed in afterTransactionCommit so the publish (which uses the
    // default DataSource) never races the in-flight transaction's connection.
    // On PGlite (pool size 1), the flush is deferred via setImmediate to
    // ensure the transaction's connection has been released first.
    private perTxn = new WeakMap<any, { computedField: ComputedFieldMetadata<any>; databaseEntity: any }[]>();

    constructor(
        private readonly solidRegistry: SolidRegistry,
        @Inject(forwardRef(() => PublisherFactory))
        private readonly publisherFactory: PublisherFactory<ComputedFieldEvaluationPayload>
    ) {
    }

    bindToDataSource(dataSource: DataSource) {
        this.dataSource = dataSource;
        this.dataSource.subscribers.push(this);
    }

    async beforeInsert(event: InsertEvent<any>): Promise<any> {
        const modelName = camelCase(event.metadata?.name ?? event.entity?.constructor?.name ?? '');
        const eventContext = this.sanitizeEventContext(event, 'beforeInsert');
        await this.handleComputedFieldEvaluation(event.entity, ComputedFieldTriggerOperation.beforeInsert, modelName, eventContext);
    }

    async beforeUpdate(event: UpdateEvent<any>): Promise<any> {
        const modelName = camelCase(event.metadata?.name ?? event.entity?.constructor?.name ?? '');
        const eventContext = this.sanitizeEventContext(event, 'beforeUpdate');
        await this.handleComputedFieldEvaluation(event.entity, ComputedFieldTriggerOperation.beforeUpdate, modelName, eventContext);
    }

    afterInsert(event: InsertEvent<any>) {
        const modelName = camelCase(event.metadata?.name ?? event.entity?.constructor?.name ?? '');
        const eventContext = this.sanitizeEventContext(event, 'afterInsert');
        this.handlePostEventJobs(event, event.entity, ComputedFieldTriggerOperation.afterInsert, modelName, eventContext);
    }

    afterUpdate(event: UpdateEvent<any>) {
        const modelName = camelCase(event.metadata?.name ?? event.entity?.constructor?.name ?? event.databaseEntity?.constructor?.name ?? '');
        const eventContext = this.sanitizeEventContext(event, 'afterUpdate');
        this.handlePostEventJobs(event, event.entity, ComputedFieldTriggerOperation.afterUpdate, modelName, eventContext);
    }

    afterRemove(event: RemoveEvent<any>) {
        const modelName = camelCase(event.metadata?.name ?? event.entity?.constructor?.name ?? event.databaseEntity?.constructor?.name ?? '');
        const eventContext = this.sanitizeEventContext(event, 'afterRemove');
        this.handlePostEventJobs(event, event.databaseEntity, ComputedFieldTriggerOperation.afterRemove, modelName, eventContext);
    }

    //FIXME: Need to add support for beforeRemove, beforeSoftRemove, afterSoftRemove, beforeRecover, afterRecover

    // --------- post-event dispatch (pglite vs non-pglite) ----------

    /**
     * On embedded PGlite (pool size 1): buffer payloads on the queryRunner and
     * flush in afterTransactionCommit (deferred via setImmediate) so the publish
     * never tries to get a second connection while the transaction is active.
     *
     * On regular Postgres: fire-and-forget publish immediately (original behaviour),
     * since the pool has spare connections.
     */
    private handlePostEventJobs(
        event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>,
        entity: any,
        currentOperation: ComputedFieldTriggerOperation,
        modelName: string,
        eventContext?: TypeOrmEventContext,
    ) {
        if (!entity) return;

        const computedFieldsTobeEvaluated = this.getComputedFieldsForEvaluation(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            modelName
        );
        if (computedFieldsTobeEvaluated.length === 0) return;

        if (isEmbeddedDb()) {
            const qr = event.queryRunner;
            const arr = this.perTxn.get(qr) ?? [];
            for (const computedField of computedFieldsTobeEvaluated) {
                arr.push({
                    computedField: this.attachContext(computedField, eventContext),
                    databaseEntity: entity,
                });
            }
            this.perTxn.set(qr, arr);
        } else {
            for (const computedField of computedFieldsTobeEvaluated) {
                this.enqueueComputedFieldEvaluationJob(
                    this.attachContext(computedField, eventContext),
                    entity,
                );
            }
        }
    }

    // --------- transaction lifecycle (pglite only) ----------
    async afterTransactionCommit(event: { queryRunner: any }) {
        const batch = this.perTxn.get(event.queryRunner) ?? [];
        this.perTxn.delete(event.queryRunner);
        if (batch.length === 0) return;

        // Deferred via setImmediate so the transaction's connection is released
        // back to the (size-1) pool before the publish tries to acquire it.
        setImmediate(() => void this.flushBatch(batch));
    }

    afterTransactionRollback(event: { queryRunner: any }) {
        this.perTxn.delete(event.queryRunner);
    }

    private async flushBatch(batch: { computedField: ComputedFieldMetadata<any>; databaseEntity: any }[]) {
        for (const { computedField, databaseEntity } of batch) {
            this.enqueueComputedFieldEvaluationJob(computedField, databaseEntity);
        }
    }

    private async handleComputedFieldEvaluation(entity: any, currentOperation: ComputedFieldTriggerOperation, modelName: string, eventContext?: TypeOrmEventContext): Promise<void> {
        if (!entity) {
            return;
        }
        const computedFieldsTobeEvaluated = this.getComputedFieldsForEvaluation(
            this.solidRegistry.getComputedFieldMetadata(),
            currentOperation,
            modelName
        );
        for (const computedField of computedFieldsTobeEvaluated) {
            await this.evaluateComputedField(this.attachContext(computedField, eventContext), entity, currentOperation);
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

    private async evaluateComputedField(computedFieldMetadata: ComputedFieldMetadata<any>, entity: any, currentOperation: ComputedFieldTriggerOperation) {
        // Skip pre-compute on insert when the payload already supplies the target field value.
        if (this.shouldSkipPreComputeOnInsert(computedFieldMetadata, entity, currentOperation)) {
            return;
        }
        const computedValue = await this.preComputeValue(computedFieldMetadata, entity);
        if (computedValue) {
            entity[computedFieldMetadata.fieldName] = computedValue; //TODO: This line here is just for backward compatibility, once the pre compute interface is change to return void, we will get rid of it.
        }
    }

    private shouldSkipPreComputeOnInsert(computedFieldMetadata: ComputedFieldMetadata<any>, entity: any, currentOperation: ComputedFieldTriggerOperation): boolean {
        if (currentOperation !== ComputedFieldTriggerOperation.beforeInsert) {
            return false;
        }
        if (!entity) {
            return false;
        }
        const fieldName = computedFieldMetadata.fieldName;
        if (!fieldName) {
            return false;
        }
        const hasValue = Object.prototype.hasOwnProperty.call(entity, fieldName) && entity[fieldName] !== undefined && entity[fieldName] !== null;
        return hasValue;
    }

    private async preComputeValue(computedFieldMetadata: ComputedFieldMetadata<any>, entity: any) {
        try {
            const provider = this.solidRegistry.getComputedFieldProvider(computedFieldMetadata.computedFieldValueProviderName);
            // Get the instance of the provider and assert it is of type IEntityComputedFieldProvider
            const providerInstance = provider.instance as IEntityPreComputeFieldProvider<any, any, any>; // IEntityComputedFieldProvider
            const computedValue = await providerInstance.preComputeValue(entity, computedFieldMetadata); //FIXME There should some way to check/assert if the provider actually has a postComputeAndSaveValue
            return computedValue; //TODO: This line here is just for backward compatibility, once the pre compute interface is change to return void, we will get rid of it.
        } catch (error: any) {
            throw new InternalServerErrorException(`Error evaluating computed field ${computedFieldMetadata.fieldName} for model ${computedFieldMetadata.modelName} for triggered entity ${entity.constructor.name}: ${error.message}`);
        }
    }

    private enqueueComputedFieldEvaluationJob(computedField: ComputedFieldMetadata<any>, databaseEntity: any) {
        const { manager: _manager, ...serializableEventContext } = computedField.eventContext ?? {};
        const payload = {
            ...computedField,
            eventContext: serializableEventContext,
            databaseEntity,
        };
        this.publisherFactory.publish({ payload }, 'ComputedFieldEvaluationPublisher');
    }

    private attachContext<T extends ComputedFieldMetadata<any>>(computedField: T, eventContext?: any): T {
        if (!eventContext) return computedField;
        return {
            ...computedField,
            computedFieldValueProviderCtxt: {
                ...(computedField.computedFieldValueProviderCtxt || {}),
            },
            eventContext,
        };
    }

    private sanitizeEventContext(event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>, eventType: string): TypeOrmEventContext {
        if (!event) return undefined;
        const base: TypeOrmEventContext = {
            metadataName: event.metadata?.name,
            eventType: eventType,
            // Only pass the transaction's EntityManager for embedded DB (PGlite),
            // where a second pooled connection mid-transaction would deadlock.
            // On regular Postgres, providers use their injected EntityManager.
            ...(isEmbeddedDb() ? { manager: event.manager } : {}),
        };
        if ("entityId" in event && event.entityId) {
            base.entityId = event.entityId;
        } else if (event.entity && (event.entity as any).id != null) {
            base.entityId = (event.entity as any).id;
        } else if ("databaseEntity" in event && (event.databaseEntity as any)?.id != null) {
            base.entityId = (event.databaseEntity as any).id;
        }
        if ("updatedColumns" in event && event.updatedColumns) {
            base.updatedColumns = event.updatedColumns.map((c: any) => c.propertyName);
        }
        if ("updatedRelations" in event && event.updatedRelations) {
            base.updatedRelations = event.updatedRelations.map((r: any) => r.propertyName);
        }
        if (event.entity) base.entity = event.entity;
        if ("databaseEntity" in event && event.databaseEntity) {
            base.databaseEntity = event.databaseEntity;
        }
        return base;
    }

}
