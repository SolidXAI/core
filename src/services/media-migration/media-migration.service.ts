import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { Media } from 'src/entities/media.entity';
import { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { MediaMigrationJob, MediaMigrationJobStatus } from 'src/entities/media-migration-job.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { PublisherFactory } from 'src/services/queues/publisher-factory.service';
import { findTargetKeyCollisions, normalizeTargetKey, resolveLocation, sameLocation } from './media-location';
import { MigrationError } from './migration-error';
import { MediaTransferService } from './media-transfer.service';
import { countSharedRowsOutsideScope, findMediaFieldsOnProvider, MigrationScope, rowsUsingLocation, scopedMediaQuery } from './media-migration-scope';

export const CLEANUP_CONFIRMATION = 'DELETE_SOURCE_FILES';

const ACTIVE_STATUSES: MediaMigrationJobStatus[] = ['pending', 'running', 'cancelling'];
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_CONCURRENCY = 4;

/** A field identified by its name and the model it belongs to, since field names repeat across models. */
export interface FieldUserKeyRef {
  modelUserKey: string;
  fieldUserKey: string;
}

export interface MediaMigrationRequest {
  sourceProviderId?: number;
  sourceProviderName?: string;
  targetProviderId?: number;
  targetProviderName?: string;
  modelMetadataIds?: number[];
  fieldMetadataIds?: number[];
  // The same scope by user key: a model's userKey is its singularName; a field's is its name.
  modelUserKeys?: string[];
  fieldUserKeys?: FieldUserKeyRef[];
  overwriteExisting?: boolean;
  batchSize?: number;
  concurrency?: number;
}

interface ValidatedRequest {
  source: MediaStorageProviderMetadata;
  target: MediaStorageProviderMetadata;
  scope: MigrationScope;
  options: { overwriteExisting: boolean; batchSize: number; concurrency: number };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

@Injectable()
export class MediaMigrationService {
  private readonly logger = new Logger(MediaMigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transfer: MediaTransferService,
    private readonly configService: ConfigService,
    private readonly publisherFactory: PublisherFactory<{ jobId: number }>,
  ) { }

  // ---- preview ----

  /** Counts and checks a migration without writing anything. */
  async preview(request: MediaMigrationRequest) {
    const { source, target, scope } = await this.validate(request, { checkActiveJobs: false });
    const sourceLocationKind = source.type;
    const sameBucket = source.type === MediaStorageProviderType.AwsS3 && target.type === MediaStorageProviderType.AwsS3
      && source.bucketName === target.bucketName;

    // Bucket checks only read, so they are safe here.
    await this.checkBuckets(source, target);

    const rowsQuery = scopedMediaQuery(this.dataSource, scope);
    const totalMediaRows = await rowsQuery.getCount();

    const fileRows: { relativeUri: string; fieldId: number; size: string | null }[] = await scopedMediaQuery(this.dataSource, scope)
      .select('media.relativeUri', 'relativeUri')
      .addSelect('scopeField.id', 'fieldId')
      .addSelect('MAX(media.fileSize)', 'size')
      .groupBy('media.relativeUri')
      .addGroupBy('scopeField.id')
      .getRawMany();

    const distinctFiles = new Map<string, number>();
    const byFieldMap = new Map<number, { files: number; bytes: number }>();
    for (const row of fileRows) {
      const size = Number(row.size ?? 0);
      distinctFiles.set(row.relativeUri, size);
      const field = byFieldMap.get(Number(row.fieldId)) ?? { files: 0, bytes: 0 };
      field.files += 1;
      field.bytes += size;
      byFieldMap.set(Number(row.fieldId), field);
    }

    const fieldIds = [...byFieldMap.keys()];
    const fields = fieldIds.length
      ? await this.dataSource.getRepository(FieldMetadata).find({ where: { id: In(fieldIds) }, relations: ['model'] })
      : [];
    const fieldById = new Map(fields.map(field => [field.id, field]));
    const byField = fieldIds.map(fieldId => {
      const field = fieldById.get(fieldId);
      return {
        fieldMetadataId: fieldId,
        fieldName: field?.name,
        modelName: field?.model?.singularName,
        files: byFieldMap.get(fieldId)!.files,
        bytes: byFieldMap.get(fieldId)!.bytes,
      };
    });

    const collisions = findTargetKeyCollisions(distinctFiles.keys());
    const sharedOutside = await countSharedRowsOutsideScope(this.dataSource, scope);
    const nullSizeRows = await scopedMediaQuery(this.dataSource, scope).andWhere('media.fileSize IS NULL').getCount();

    const warnings: string[] = [];
    if (sameBucket) {
      warnings.push('No files are copied. S3 access is controlled by the bucket policy; this only changes how URLs are generated.');
    }
    if (source.isPublic === false && target.isPublic !== false) {
      warnings.push('Files from a private provider will become publicly reachable.');
    }
    if (sharedOutside > 0) {
      warnings.push(`${sharedOutside} media row(s) outside this scope use the same files. They will be moved too.`);
    }
    if (collisions.length > 0) {
      warnings.push(`${collisions.length} target file name(s) are shared by different source files. The migration will fail for those files until they are renamed.`);
    }
    if (nullSizeRows > 0) {
      warnings.push(`${nullSizeRows} media row(s) have no recorded size, so they are not included in the byte total.`);
    }

    // Media fields that still store uploads on the source provider. Linking them to the target is done in
    // the metadata, outside the job, so this list is what the admin must update.
    const fieldsOnSourceProvider = await findMediaFieldsOnProvider(this.dataSource, scope);

    return {
      sourceProvider: source.name,
      targetProvider: target.name,
      sourceType: sourceLocationKind,
      sameLocation: sameBucket,
      totalFiles: distinctFiles.size,
      totalMediaRows,
      totalBytes: [...distinctFiles.values()].reduce((sum, size) => sum + size, 0),
      byField,
      fieldsOnSourceProvider,
      collisions,
      warnings,
    };
  }

  // ---- create ----

  /** Creates a migration job after all checks, including a write test on the target, and queues it. */
  async create(request: MediaMigrationRequest): Promise<MediaMigrationJob> {
    const { source, target, scope, options } = await this.validate(request);
    await this.checkBuckets(source, target);

    const defaultRegion = this.defaultRegion();
    await this.transfer.probeWritable(resolveLocation(target, 'probe', defaultRegion)).catch(error => {
      throw new BadRequestException(error instanceof MigrationError ? error.message : String(error));
    });

    const preview = await this.preview(request);
    const jobRepo = this.dataSource.getRepository(MediaMigrationJob);
    const job = await jobRepo.save(jobRepo.create({
      sourceProvider: source,
      targetProvider: target,
      modelMetadataIds: scope.modelMetadataIds?.length ? scope.modelMetadataIds : null,
      fieldMetadataIds: scope.fieldMetadataIds?.length ? scope.fieldMetadataIds : null,
      status: 'pending',
      overwriteExisting: options.overwriteExisting,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      totalCount: preview.totalFiles,
      totalBytes: preview.totalBytes,
      warnings: preview.warnings,
    } as any) as unknown as MediaMigrationJob);

    try {
      await this.publish(job.id);
    } catch (error: any) {
      // A job that was never queued would wait forever and block this provider, so close it.
      const reason = `The job could not be queued: ${error?.message ?? error}`;
      await this.updateJob(job.id, { status: 'failed', finishedAt: new Date(), errorMessage: reason });
      throw new BadRequestException(`${reason} Check the queue settings (QUEUES_DEFAULT_BROKER and QUEUES_SERVICE_ROLE) and try again.`);
    }
    this.logger.log(`Queued media migration job ${job.id} (${source.name} -> ${target.name})`);
    return job;
  }

  // ---- control ----

  /**
   * Stops a job. A pending job, or one whose worker is gone, is cancelled at once; a running one stops
   * after its current batch. Each change only applies if the job is still in the state it was read in,
   * so a worker starting at the same moment cannot undo it.
   */
  async cancel(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.loadJob(jobId);
    const repo = this.dataSource.getRepository(MediaMigrationJob);
    const cancelled = { status: 'cancelled' as const, finishedAt: new Date(), leaseToken: null, leaseExpiresAt: null };

    if (job.status === 'pending') {
      const result = await repo.update({ id: jobId, status: 'pending' }, cancelled);
      if ((result.affected ?? 0) === 0) {
        // A worker took the job in the meantime: ask it to stop instead.
        return this.cancel(jobId);
      }
    } else if (job.status === 'running' || job.status === 'cancelling') {
      if (this.hasLiveWorker(job)) {
        await repo.update({ id: jobId, status: In(['running', 'cancelling']) }, { status: 'cancelling' });
      } else {
        // The worker is gone, so nothing would ever see a "cancelling" request.
        await repo.update({ id: jobId, status: In(['running', 'cancelling']) }, cancelled);
      }
    } else {
      throw new BadRequestException(`Job #${jobId} is ${job.status} and cannot be cancelled.`);
    }
    return this.loadJob(jobId);
  }

  // A worker is alive while it keeps renewing the job's lease.
  private hasLiveWorker(job: MediaMigrationJob): boolean {
    return !!job.leaseToken && !!job.leaseExpiresAt && job.leaseExpiresAt > new Date();
  }

  /**
   * Continues a job from where it stopped: a failed or cancelled job, one whose worker is gone, or a
   * pending job whose queue message never arrived (it is queued again; only one worker can run it).
   */
  async resume(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.loadJob(jobId);
    const orphaned = ['running', 'cancelling'].includes(job.status) && !this.hasLiveWorker(job);
    if (!['failed', 'cancelled', 'pending'].includes(job.status) && !orphaned) {
      throw new BadRequestException(`Job #${jobId} is ${job.status} and cannot be resumed.`);
    }
    if (job.status !== 'pending') {
      // A pending job may be starting right now, so only clear the lease of one that is truly orphaned or finished.
      await this.updateJob(jobId, { status: 'pending', errorMessage: null, leaseToken: null, leaseExpiresAt: null });
    }
    await this.publish(jobId);
    return this.loadJob(jobId);
  }

  /** Runs again the files that failed. Files already migrated are not copied again. */
  async retryFailed(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.loadJob(jobId);
    if (!['completed_with_errors', 'failed'].includes(job.status)) {
      throw new BadRequestException(`Job #${jobId} is ${job.status}. Only jobs that finished with failures can be retried.`);
    }
    await this.dataSource.getRepository(MediaMigrationItem).update(
      { job: { id: jobId }, status: 'failed' },
      { status: 'pending', errorCode: null, errorMessage: null },
    );
    await this.updateJob(jobId, { status: 'pending', lastProcessedMediaId: 0, errorMessage: null, finishedAt: null });
    await this.publish(jobId);
    return this.loadJob(jobId);
  }

  /**
   * Moves migrated media rows back to the source provider. Source files were never changed, so this
   * is safe until cleanup has removed them.
   */
  async rollback(jobId: number): Promise<{ job: MediaMigrationJob; targetFilesLeft: number }> {
    const job = await this.loadJob(jobId);
    if (!['completed', 'completed_with_errors', 'cancelled'].includes(job.status)) {
      throw new BadRequestException(`Job #${jobId} is ${job.status}. Rollback needs a finished job.`);
    }
    const removed = await this.dataSource.getRepository(MediaMigrationItem).count({ where: { job: { id: jobId }, status: 'source_deleted' } });
    if (removed > 0) {
      throw new BadRequestException(`Job #${jobId} already removed ${removed} source file(s), so it cannot be rolled back.`);
    }

    const completed = await this.dataSource.getRepository(MediaMigrationItem).find({ where: { job: { id: jobId }, status: 'completed' } });
    for (const item of completed) {
      await this.dataSource.transaction(async manager => {
        const rows = await manager.getRepository(Media).createQueryBuilder('media').withDeleted()
          .innerJoin('media.mediaStorageProviderMetadata', 'provider')
          .where('provider.id = :targetId', { targetId: job.targetProvider.id })
          .andWhere('media.id IN (:...ids)', { ids: item.mediaIds.length ? item.mediaIds : [0] })
          .select(['media.id'])
          .getMany();
        if (rows.length > 0) {
          await manager.createQueryBuilder()
            .update(Media)
            .set({ mediaStorageProviderMetadata: { id: job.sourceProvider.id } as any, relativeUri: item.sourceKey })
            .where('id IN (:...ids)', { ids: rows.map(row => row.id) })
            .execute();
        }
        await manager.getRepository(MediaMigrationItem).update({ id: item.id }, { status: 'rolled_back' });
      });
    }
    await this.updateJob(jobId, {
      status: 'rolled_back',
      finishedAt: new Date(),
    });

    const targetFilesLeft = await this.dataSource.getRepository(MediaMigrationItem).count({ where: { job: { id: jobId }, copied: true } });
    return { job: await this.loadJob(jobId), targetFilesLeft };
  }

  /**
   * Deletes the source files of completed items, after checking that the target copy is complete and
   * that no media row still uses the source file. Items that fail a check are skipped and reported.
   */
  async cleanupSource(jobId: number, confirm: string): Promise<{ deleted: number; skipped: { itemId: number; reason: string }[] }> {
    if (confirm !== CLEANUP_CONFIRMATION) {
      throw new BadRequestException(`Deleting source files needs confirm: "${CLEANUP_CONFIRMATION}" in the request body.`);
    }
    const job = await this.loadJob(jobId);
    if (!['completed', 'completed_with_errors'].includes(job.status)) {
      throw new BadRequestException(`Job #${jobId} is ${job.status}. Source files can only be removed after the job has finished.`);
    }

    const defaultRegion = this.defaultRegion();
    const items = await this.dataSource.getRepository(MediaMigrationItem).find({ where: { job: { id: jobId }, status: 'completed' } });
    const skipped: { itemId: number; reason: string }[] = [];
    let deleted = 0;

    for (const item of items) {
      try {
        const source = resolveLocation(job.sourceProvider, item.sourceKey, defaultRegion);
        const target = resolveLocation(job.targetProvider, item.targetKey ?? item.sourceKey, defaultRegion);
        if (sameLocation(source, target)) {
          skipped.push({ itemId: item.id, reason: 'Source and target are the same stored file.' });
          continue;
        }
        if (item.targetSize === null || item.targetSize === undefined) {
          skipped.push({ itemId: item.id, reason: 'The target size was not recorded, so the copy cannot be verified.' });
          continue;
        }
        const targetStat = await this.transfer.stat(target, 'target');
        if (!targetStat || targetStat.size !== item.targetSize) {
          skipped.push({ itemId: item.id, reason: 'The target copy is missing or has a different size.' });
          continue;
        }
        const stillUsed = await rowsUsingLocation(this.dataSource, source, defaultRegion);
        if (stillUsed.length > 0) {
          skipped.push({ itemId: item.id, reason: `${stillUsed.length} media row(s) still use the source file.` });
          continue;
        }
        await this.transfer.delete(source, 'source');
        await this.dataSource.getRepository(MediaMigrationItem).update({ id: item.id }, { status: 'source_deleted' });
        deleted += 1;
      } catch (error: any) {
        skipped.push({ itemId: item.id, reason: error instanceof MigrationError ? error.message : (error?.message ?? String(error)) });
      }
    }
    return { deleted, skipped };
  }

  // ---- shared ----

  private async validate(request: MediaMigrationRequest, options: { checkActiveJobs: boolean } = { checkActiveJobs: true }): Promise<ValidatedRequest> {
    // The app does not reject unknown request fields, so an old client that still sends entityIds would
    // silently migrate far more than it meant to. Refuse it instead.
    if ((request as any).entityIds !== undefined) {
      throw new BadRequestException(
        'entityIds is no longer supported. Scope a migration by modelMetadataIds or fieldMetadataIds. ' +
        'To try a migration first, move one small field and roll it back if anything looks wrong.',
      );
    }

    const source = await this.findProvider(request.sourceProviderId, request.sourceProviderName, 'source');
    const target = await this.findProvider(request.targetProviderId, request.targetProviderName, 'target');

    if (source.id === target.id) {
      throw new BadRequestException('The source and target provider are the same. Choose a different target.');
    }
    for (const provider of [source, target]) {
      if (![MediaStorageProviderType.Filesystem, MediaStorageProviderType.AwsS3].includes(provider.type as MediaStorageProviderType)) {
        throw new BadRequestException(`Provider "${provider.name}" is of type "${provider.type}", which cannot be migrated. Use filesystem or aws-s3.`);
      }
      if (provider.type === MediaStorageProviderType.AwsS3 && (!process.env.S3_AWS_ACCESS_KEY || !process.env.S3_AWS_SECRET_KEY)) {
        throw new BadRequestException('S3_AWS_ACCESS_KEY and S3_AWS_SECRET_KEY must be set to migrate to or from S3.');
      }
      try {
        resolveLocation(provider, 'check', this.defaultRegion());
      } catch (error) {
        throw new BadRequestException(error instanceof MigrationError ? error.message : String(error));
      }
    }

    // Ids and user keys can be mixed; the scope is the union of both, resolved to ids once here.
    const byKey = await this.resolveUserKeys(request);
    const modelIds = unique([...(request.modelMetadataIds ?? []), ...byKey.modelIds]);
    const fieldIds = unique([...(request.fieldMetadataIds ?? []), ...byKey.fieldIds]);
    const scope: MigrationScope = {
      sourceProviderId: source.id,
      modelMetadataIds: modelIds.length ? modelIds : null,
      fieldMetadataIds: fieldIds.length ? fieldIds : null,
    };
    await this.assertScopeExists(scope);

    // Only one job may run per source provider at a time. Preview only reports, so it skips this check.
    const active = options.checkActiveJobs
      ? await this.dataSource.getRepository(MediaMigrationJob).findOne({
        where: { sourceProvider: { id: source.id }, status: In(ACTIVE_STATUSES) },
      })
      : null;
    if (active) {
      throw new BadRequestException(`Migration job #${active.id} is already ${active.status} for provider "${source.name}". Wait for it to finish or cancel it.`);
    }

    const clamp = (value: number | undefined, fallback: number, min: number, max: number) =>
      Math.min(max, Math.max(min, Math.floor(value ?? fallback)));

    return {
      source,
      target,
      scope,
      options: {
        overwriteExisting: request.overwriteExisting ?? false,
        batchSize: clamp(request.batchSize, DEFAULT_BATCH_SIZE, 10, 1000),
        concurrency: clamp(request.concurrency, DEFAULT_CONCURRENCY, 1, 16),
      },
    };
  }

  private async findProvider(id: number | undefined, name: string | undefined, role: string): Promise<MediaStorageProviderMetadata> {
    const repo = this.dataSource.getRepository(MediaStorageProviderMetadata);
    const provider = id
      ? await repo.findOne({ where: { id } })
      : name ? await repo.findOne({ where: { name } }) : null;
    if (!provider) {
      throw new BadRequestException(`Choose a ${role} provider by id or name. "${id ?? name ?? ''}" was not found.`);
    }
    return provider;
  }

  // Turns model and field user keys into ids. An unknown key is refused by name, so a typo cannot
  // quietly migrate less than the admin meant.
  private async resolveUserKeys(request: MediaMigrationRequest): Promise<{ modelIds: number[]; fieldIds: number[] }> {
    const modelKeys = unique(request.modelUserKeys ?? []);
    const modelIds: number[] = [];
    if (modelKeys.length) {
      const models = await this.dataSource.getRepository(ModelMetadata).find({ where: { singularName: In(modelKeys) } });
      const found = new Set(models.map(model => model.singularName));
      const missing = modelKeys.filter(key => !found.has(key));
      if (missing.length) {
        throw new BadRequestException(`Unknown model userKey: ${missing.map(key => `"${key}"`).join(', ')}. A model's userKey is its singularName.`);
      }
      modelIds.push(...models.map(model => model.id));
    }

    const fieldIds: number[] = [];
    for (const ref of request.fieldUserKeys ?? []) {
      const field = await this.dataSource.getRepository(FieldMetadata).findOne({
        where: { name: ref.fieldUserKey, model: { singularName: ref.modelUserKey } },
      });
      if (!field) {
        throw new BadRequestException(`Unknown field userKey "${ref.fieldUserKey}" on model "${ref.modelUserKey}".`);
      }
      fieldIds.push(field.id);
    }
    return { modelIds, fieldIds: unique(fieldIds) };
  }

  private async assertScopeExists(scope: MigrationScope): Promise<void> {
    const checks: [string, number[] | null | undefined, any][] = [
      ['model', scope.modelMetadataIds, ModelMetadata],
      ['field', scope.fieldMetadataIds, FieldMetadata],
    ];
    for (const [label, ids, entity] of checks) {
      if (!ids?.length) continue;
      const found = await this.dataSource.getRepository(entity).count({ where: { id: In(ids) } });
      if (found !== new Set(ids).size) {
        throw new BadRequestException(`Some ${label} ids in the scope do not exist.`);
      }
    }
  }

  private async checkBuckets(source: MediaStorageProviderMetadata, target: MediaStorageProviderMetadata): Promise<void> {
    for (const [provider, role] of [[source, 'source'], [target, 'target']] as const) {
      if (provider.type !== MediaStorageProviderType.AwsS3) continue;
      await this.transfer.assertBucketReachable(resolveLocation(provider, 'check', this.defaultRegion()), role)
        .catch(error => {
          throw new BadRequestException(error instanceof MigrationError ? error.message : String(error));
        });
    }
  }

  private defaultRegion(): string | undefined {
    return this.configService.get<string>('S3_AWS_REGION_NAME') || undefined;
  }

  private async loadJob(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.dataSource.getRepository(MediaMigrationJob).findOne({
      where: { id: jobId },
      relations: ['sourceProvider', 'targetProvider'],
    });
    if (!job) {
      throw new NotFoundException(`Media migration job #${jobId} not found`);
    }
    return job;
  }

  // Publishes through the configured broker (database, redis or rabbitmq), by publisher name.
  private async publish(jobId: number): Promise<void> {
    await this.publisherFactory.publish({ payload: { jobId } } as any, 'MediaMigrationPublisher');
  }

  private async updateJob(jobId: number, fields: Partial<MediaMigrationJob>): Promise<void> {
    await this.dataSource.getRepository(MediaMigrationJob).update({ id: jobId }, fields as any);
  }
}
