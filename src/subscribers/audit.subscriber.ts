import { Injectable, Logger, Scope } from '@nestjs/common';
import { lowerFirst } from 'src/helpers/string.helper';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { DataSource, EntityMetadata, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { AuditQueuePayload } from 'src/interfaces';
import { RequestContextService } from 'src/services/request-context.service';
import { PublisherFactory } from 'src/services/queues/publisher-factory.service';

@Injectable({scope: Scope.TRANSIENT})
export class AuditSubscriber implements EntitySubscriberInterface {
    private readonly logger = new Logger(AuditSubscriber.name);
    private dataSource: DataSource;
    constructor(
        private readonly publisherFactory: PublisherFactory<AuditQueuePayload>,
        private readonly solidRegistry: SolidRegistry,
        private readonly requestContextService: RequestContextService,
    ) { }

    bindToDataSource(dataSource: DataSource) {
        this.dataSource = dataSource;
        this.dataSource.subscribers.push(this);
    }

    // Per-transaction buffer (auto-GC when queryRunner is gone)
    private perTxn = new WeakMap<any, AuditQueuePayload[]>();

    private enqueue(event: { queryRunner: any }, payload: AuditQueuePayload) {
        const qr = event.queryRunner;
        const arr = this.perTxn.get(qr) ?? [];
        arr.push(payload);
        this.perTxn.set(qr, arr);
    }

    private shouldTrackAudit(metadata: EntityMetadata): boolean {
        return this.solidRegistry.isAuditableModel(lowerFirst(metadata.name));
    }

    private activeUserId(): number | null {
        return this.requestContextService.getActiveUser()?.sub ?? null;
    }

    async afterInsert(event: InsertEvent<any>) {
        if (!this.shouldTrackAudit(event.metadata)) return;
        this.enqueue(event, {
            eventType: 'insert',
            modelName: event.metadata.name,
            entityId: event.entity?.id ?? null,
            occurredAt: new Date().toISOString(),
            after: event.entity ?? null,
            userId: this.activeUserId(),
        });
    }

    async afterUpdate(event: UpdateEvent<any>) {
        if (!this.shouldTrackAudit(event.metadata)) return;
        this.enqueue(event, {
            eventType: 'update',
            modelName: event.metadata.name,
            entityId: event.entity?.id ?? null,
            occurredAt: new Date().toISOString(),
            after: event.entity ?? null,
            // databaseEntity is only populated when the entity was fetched first (save() path).
            // QueryBuilder update() leaves this undefined; postAuditMessageOnUpdate guards for it.
            before: event.databaseEntity ?? null,
            updatedColumnNames: (event.updatedColumns ?? []).map(c => c.propertyName),
            userId: this.activeUserId(),
        });
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (!this.shouldTrackAudit(event.metadata)) return;
        this.enqueue(event, {
            eventType: 'delete',
            modelName: event.metadata.name,
            entityId: event.databaseEntity?.id ?? null,
            occurredAt: new Date().toISOString(),
            before: event.databaseEntity,
            userId: this.activeUserId(),
        });
    }

    // --------- transaction lifecycle ----------
    async afterTransactionCommit(event: { queryRunner: any }) {
        const batch = this.perTxn.get(event.queryRunner) ?? [];
        this.perTxn.delete(event.queryRunner);

        // Now outside the DB transaction — safe to publish to the queue.
        // allSettled: publish in parallel; a single failure does not block the rest.
        const results = await Promise.allSettled(
            batch.map(payload => this.publisherFactory.publish({ payload }, 'ChatterQueuePublisher'))
        );

        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                this.logger.error(
                    `Failed to publish audit event for ${batch[i].modelName}#${batch[i].entityId}`,
                    result.reason,
                );
            }
        });
    }

    afterTransactionRollback(event: { queryRunner: any }) {
        // Drop buffered payloads; the write never happened.
        this.perTxn.delete(event.queryRunner);
    }
}
