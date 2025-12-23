import { forwardRef, Inject, Injectable, Scope } from '@nestjs/common';
import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
import { lowerFirst } from 'src/helpers/string.helper';
import { ModelMetadataRepository } from 'src/repository/model-metadata.repository';
import { DataSource, EntityMetadata, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { ChatterMessageService } from '../services/chatter-message.service';


type DeferredCall =
    | { kind: 'insert'; args: Parameters<ChatterMessageService['postAuditMessageOnInsert']> }
    | { kind: 'update'; args: Parameters<ChatterMessageService['postAuditMessageOnUpdate']> }
    | { kind: 'delete'; args: Parameters<ChatterMessageService['postAuditMessageOnDelete']> };

@Injectable({scope: Scope.TRANSIENT})
// @EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
    private dataSource: DataSource;
    constructor(
        // @InjectDataSource()
        // private readonly dataSource: DataSource,
        private readonly chatterMessageService: ChatterMessageService,
        // @InjectRepository(ModelMetadata)
        // private readonly modelMetadataRepo: Repository<ModelMetadata>,
        @Inject(forwardRef(() => ModelMetadataRepository))
        private readonly modelMetadataRepo: ModelMetadataRepository,
        private readonly modelMetadataHelperService: ModelMetadataHelperService,
    ) {
        // this.dataSource.subscribers.push(this);
    }

    bindToDataSource(dataSource: DataSource) {
        this.dataSource = dataSource;
        this.dataSource.subscribers.push(this);
    }

    // Per-transaction buffer (auto-GC when queryRunner is gone)
    private perTxn = new WeakMap<any, DeferredCall[]>();

    private enqueue(event: { queryRunner: any }, call: DeferredCall) {
        const qr = event.queryRunner;
        const arr = this.perTxn.get(qr) ?? [];
        arr.push(call);
        this.perTxn.set(qr, arr);
    }

    private async shouldTrackAudit(entity: any, metadata: EntityMetadata): Promise<boolean> {
        const model = await this.modelMetadataRepo.findOne({
            where: {
                singularName: lowerFirst(metadata.name)
            },
            relations: {
                fields: true,
                module: true
            }
        });

        if (!model || !model.enableAuditTracking) {
            return false;
        }

        const modelFields = await this.modelMetadataHelperService.loadFieldHierarchy(model.singularName)

        const auditFields = modelFields.filter(field =>
            field.enableAuditTracking &&
            !['mediaSingle', 'mediaMultiple', 'richText', 'json'].includes(field.type) &&
            !(field.type === 'relation' && field.relationType === 'one-to-many')
        );

        if (auditFields.length === 0) {
            return false;
        }

        // if (!entity) {
        //     console.warn(`[AuditSubscriber] Skipping audit for ${metadata.name} – entity is undefined or null`);
        //     return false;
        // }

        return entity && auditFields.some(field => {
            const fieldValue = entity[field.name];
            return fieldValue !== undefined && fieldValue !== null;
        });
    }

    async afterInsert(event: InsertEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            // await this.chatterMessageService.postAuditMessageOnInsert(event.entity, event.metadata);
            this.enqueue(event, {
                kind: 'insert',
                args: [event.entity, event.metadata] as Parameters<ChatterMessageService['postAuditMessageOnInsert']>,
            });
        }
    }

    async afterUpdate(event: UpdateEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            // await this.chatterMessageService.postAuditMessageOnUpdate(event.entity, event.metadata, event.databaseEntity, event.updatedColumns || []);
            this.enqueue(event, {
                kind: 'update',
                args: [
                    event.entity, // entity (after)
                    event.metadata,
                    event.databaseEntity, // entity (before)
                    event.updatedColumns ?? [],
                ] as Parameters<ChatterMessageService['postAuditMessageOnUpdate']>,
            });
        }
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (await this.shouldTrackAudit(event.entity, event.metadata)) {
            // await this.chatterMessageService.postAuditMessageOnDelete(event.entity, event.metadata, event.databaseEntity);
            this.enqueue(event, {
                kind: 'delete',
                args: [
                    event.entity,
                    event.metadata,
                    event.databaseEntity,
                ] as Parameters<ChatterMessageService['postAuditMessageOnDelete']>,
            });
        }
    }

    // --------- transaction lifecycle ----------
    async afterTransactionCommit(event: { queryRunner: any }) {
        const batch = this.perTxn.get(event.queryRunner) ?? [];
        this.perTxn.delete(event.queryRunner);

        // Now we’re OUTSIDE the DB transaction — safe to do I/O/DB writes inside chatter service.
        for (const item of batch) {
            try {
                switch (item.kind) {
                    case 'insert': await this.chatterMessageService.postAuditMessageOnInsert(...item.args); break;
                    case 'update': await this.chatterMessageService.postAuditMessageOnUpdate(...item.args); break;
                    case 'delete': await this.chatterMessageService.postAuditMessageOnDelete(...item.args); break;
                }
            } catch (e) {
                // Best effort: log and continue; your core txn was already committed
                // Optionally: send to a generic error logger/metric here
            }
        }
    }

    afterTransactionRollback(event: { queryRunner: any }) {
        // Drop buffered calls; the write never happened
        this.perTxn.delete(event.queryRunner);
    }
}

// import { DataSource, EntityMetadata, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
// import { Injectable } from '@nestjs/common';
// import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { ModelMetadata } from '../entities/model-metadata.entity';
// import { lowerFirst } from 'src/helpers/string.helper';
// import { ModelMetadataHelperService } from 'src/helpers/model-metadata-helper.service';
// import { ChatterMessagePayload } from 'src/jobs/chatter-queue-publisher.service';
// import { RequestContextService } from 'src/services/request-context.service';
// import { PublisherFactory } from 'src/services/queues/publisher-factory.service';

// @EventSubscriber()
// @Injectable()
// export class AuditSubscriber implements EntitySubscriberInterface {
//     private perTxn = new WeakMap<any, ChatterMessagePayload[]>();

//     constructor(
//         @InjectDataSource() private readonly dataSource: DataSource,
//         @InjectRepository(ModelMetadata) private readonly modelMetadataRepo: Repository<ModelMetadata>,
//         private readonly modelMetadataHelperService: ModelMetadataHelperService,
//         private readonly requestContext: RequestContextService,
//         private readonly publisherFactory: PublisherFactory<any>
//     ) {
//         this.dataSource.subscribers.push(this);
//     }

//     // --- small cache to avoid metadata queries on every row ---
//     private modelCache = new Map<string, { enable: boolean; fields: Array<{ name: string; enableAuditTracking: boolean; type: string; relationType?: string }>; ts: number }>();
//     private cacheTTLms = 60_000;

//     private async shouldTrackAudit(entity: any, metadata: EntityMetadata): Promise<{ enable: boolean; auditFields?: string[] }> {
//         const key = metadata.name;
//         const now = Date.now();
//         const cached = this.modelCache.get(key);
//         if (cached && (now - cached.ts) < this.cacheTTLms) {
//             if (!cached.enable) return { enable: false };
//             const fields = cached.fields.filter(f =>
//                 f.enableAuditTracking &&
//                 !['mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(f.type) &&
//                 !(f.type === 'relation' && f.relationType === 'one-to-many')
//             );
//             const present = fields.map(f => f.name).filter(n => entity?.[n] !== undefined);
//             return { enable: present.length > 0, auditFields: present };
//         }

//         const model = await this.modelMetadataRepo.findOne({
//             where: { singularName: lowerFirst(metadata.name) },
//             relations: { fields: true, module: true },
//         });
//         const enable = !!model?.enableAuditTracking;
//         const fields = model?.fields ?? [];
//         this.modelCache.set(key, { enable, fields, ts: now });

//         if (!enable) return { enable: false };
//         const filtered = fields.filter(f =>
//             f.enableAuditTracking &&
//             !['mediaSingle', 'mediaMultiple', 'computed', 'richText', 'json'].includes(f.type) &&
//             !(f.type === 'relation' && f.relationType === 'one-to-many')
//         );
//         const present = filtered.map(f => f.name).filter(n => entity?.[n] !== undefined);
//         return { enable: present.length > 0, auditFields: present };
//     }

//     private push(event: { queryRunner: any }, msg: ChatterMessagePayload) {
//         const arr = this.perTxn.get(event.queryRunner) ?? [];
//         arr.push(msg);
//         this.perTxn.set(event.queryRunner, arr);
//     }

//     async afterInsert(event: InsertEvent<any>) {
//         if (!event.entity) return;
//         const enable = await this.shouldTrackAudit(event.entity, event.metadata);
//         if (!enable) return;

//         const payload: ChatterMessagePayload = {
//             eventType: 'insert',
//             model: event.metadata.name,
//             entityId: String(event.entity.id ?? event.entity.uuid ?? ''),
//             occurredAt: new Date().toISOString(),
//             after: this.safeCopy(event.entity),
//             userId: this.getUserId(),
//         };
//         this.push(event, payload);
//     }

//     async afterUpdate(event: UpdateEvent<any>) {
//         // Updated entity may be null if you used raw query; fall back to databaseEntity
//         const current = event.entity ?? {};
//         const before = event.databaseEntity ?? {};
//         const { enable, auditFields } = await this.shouldTrackAudit(current, event.metadata);
//         if (!enable) return;

//         const changedCols = (event.updatedColumns || []).map(c => c.propertyName);
//         const payload: ChatterMessagePayload = {
//             eventType: 'update',
//             model: event.metadata.name,
//             entityId: String((current as any).id ?? (before as any).id ?? ''),
//             occurredAt: new Date().toISOString(),
//             before: this.pick(before, auditFields || changedCols),
//             after: this.pick(current, auditFields || changedCols),
//             diff: changedCols,
//             userId: this.getUserId(),
//         };
//         this.push(event, payload);
//     }

//     async afterRemove(event: RemoveEvent<any>) {
//         const base = event.entity ?? event.databaseEntity;
//         if (!base) return;

//         const { enable } = await this.shouldTrackAudit(base, event.metadata);
//         if (!enable) return;

//         const payload: ChatterMessagePayload = {
//             eventType: 'delete',
//             model: event.metadata.name,
//             entityId: String((base as any).id ?? ''),
//             occurredAt: new Date().toISOString(),
//             before: this.safeCopy(base),
//             userId: this.getUserId(),
//         };
//         this.push(event, payload);
//     }

//     // Publish AFTER the transaction commits -> no idle-in-transaction
//     async afterTransactionCommit(event: { queryRunner: any }) {
//         const batch = this.perTxn.get(event.queryRunner) ?? [];
//         this.perTxn.delete(event.queryRunner);
//         for (const msg of batch) {
//             try {
//                 await this.publisherFactory.publish({ payload: msg, parentEntity: msg.model, parentEntityId: msg.entityId }, 'ChatterQueuePublisher');
//             } catch (err) {
//                 // log + optionally send to a DLQ or retry queue
//                 // do NOT throw; commit already happened
//                 // your RabbitMqPublisher likely tracks failures in MqMessage tables anyway
//             }
//         }
//     }

//     afterTransactionRollback(event: { queryRunner: any }) {
//         this.perTxn.delete(event.queryRunner);
//     }

//     // --- small helpers to keep payloads JSON-safe and small ---
//     private safeCopy(obj: any) {
//         try {
//             return JSON.parse(JSON.stringify(obj));
//         } catch {
//             return {}; // strip circular refs
//         }
//     }

//     private pick(obj: any, keys: string[]) {
//         const out: any = {};
//         for (const k of keys) out[k] = obj?.[k];
//         return this.safeCopy(out);
//     }

//     private getUserId(): string | null {

//         const activeUser = this.requestContext.getActiveUser();
//         if (activeUser?.sub)
//             return String(activeUser.sub);
//     }


// }