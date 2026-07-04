import { Injectable, Logger, Scope } from '@nestjs/common';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { lowerFirst } from 'src/helpers/string.helper';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { DataSource, EntityMetadata, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { AuditQueuePayload } from 'src/interfaces';
import { isEmbeddedDb } from 'src/helpers/environment.helper';
import { RequestContextService } from 'src/services/request-context.service';
import { PublisherFactory } from 'src/services/queues/publisher-factory.service';
const AUDIT_BEFORE_SNAPSHOT = '__auditBeforeSnapshot';

@Injectable({ scope: Scope.TRANSIENT })
export class AuditSubscriber implements EntitySubscriberInterface {
    private readonly logger = new Logger(AuditSubscriber.name);
    private dataSource: DataSource;
    constructor(
        private readonly publisherFactory: PublisherFactory<AuditQueuePayload>,
        private readonly solidRegistry: SolidRegistry,
        private readonly requestContextService: RequestContextService,
        private readonly modelMetadataHelperService: ModelMetadataHelperService,
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
        const entityId = event.entity?.id ?? event.databaseEntity?.id ?? (event as any).entityId ?? null;
        let before = event.databaseEntity ?? null;
        let after = event.entity ?? null;
        const updatedColumnNames = (event.updatedColumns ?? []).map(c => c.propertyName);

        const auditResult = await this.prepareManyToManyAuditUpdateSnapshot(event, entityId, updatedColumnNames);

        if (auditResult) {
            before = auditResult.before;
            after = auditResult.after;
        }

        this.enqueue(event, {
            eventType: 'update',
            modelName: event.metadata.name,
            entityId: entityId,
            occurredAt: new Date().toISOString(),
            after: after,
            // databaseEntity is only populated when the entity was fetched first (save() path).
            // QueryBuilder update() leaves this undefined; postAuditMessageOnUpdate guards for it.
            before: before,
            updatedColumnNames: updatedColumnNames,
            userId: this.activeUserId(),
        });
    }

    /**
     * Resolves before/after snapshots for audit-enabled many-to-many relations
     * and updates changed relation field names for audit tracking.
     */
    private async prepareManyToManyAuditUpdateSnapshot(event: UpdateEvent<any>, entityId: number | null, updatedColumnNames: string[]): Promise<{ before: any; after: any } | null> {

        // On embedded PGlite, pass the transaction's manager so the query runs
        // on the active connection. On regular Postgres, use the default DataSource.
        const mgr = isEmbeddedDb() ? event.manager : this.dataSource;
        const auditRelationFields = (await this.modelMetadataHelperService.loadFieldHierarchy(lowerFirst(event.metadata.name), isEmbeddedDb() ? event.manager : undefined)).filter(field =>
            field.enableAuditTracking &&
            field.type === 'relation' &&
            field.relationType !== 'one-to-many'
        );

        if (!entityId || auditRelationFields.length === 0) {
            return null;
        }

        const relations: Record<string, boolean> = {};

        auditRelationFields.forEach(field => {
            relations[field.name] = true;
        });

        const relationBefore = event.entity?.[AUDIT_BEFORE_SNAPSHOT] ?? null;

        const relationAfter = await mgr.getRepository(event.metadata.target as any).findOne({
            where: { id: entityId } as any,
            relations: relations as any,
        });

        if (relationBefore && relationAfter) {
            auditRelationFields.forEach(field => {
                const oldIds = Array.isArray(relationBefore[field.name])
                    ? relationBefore[field.name].map(item => item.id).sort()
                    : [];

                const newIds = Array.isArray(relationAfter[field.name])
                    ? relationAfter[field.name].map(item => item.id).sort()
                    : [];

                if ((oldIds.length !== newIds.length || JSON.stringify(oldIds) !== JSON.stringify(newIds))
                    && !updatedColumnNames.includes(field.name)) {
                    updatedColumnNames.push(field.name);
                }
            });
        }
        return {
            before: relationBefore ?? event.databaseEntity ?? null,
            after: relationAfter ?? event.entity ?? null,
        };
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

        if (batch.length === 0) return;

        if (isEmbeddedDb()) {
            setImmediate(() => void this.publishAuditBatch(batch));
            return;
        }

        await this.publishAuditBatch(batch);
    }

    afterTransactionRollback(event: { queryRunner: any }) {
        // Drop buffered payloads; the write never happened.
        this.perTxn.delete(event.queryRunner);
    }

    private async publishAuditBatch(batch: AuditQueuePayload[]) {
        try {
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
        } catch (error) {
            this.logger.error('Failed to publish audit batch', error);
        }
    }
}
