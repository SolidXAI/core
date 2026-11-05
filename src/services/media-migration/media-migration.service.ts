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
import { scopedMediaQuery, sharedRowsOutsideScope, MigrationScope } from './media-migration-scope';

export const CLEANUP_CONFIRMATION = 'DELETE_SOURCE_FILES';

const ACTIVE_STATUSES: MediaMigrationJobStatus[] = ['pending', 'running', 'cancelling'];
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_CONCURRENCY = 4;

export interface MediaMigrationRequest {
  sourceProviderId?: number;
  sourceProviderName?: string;
  targetProviderId?: number;
  targetProviderName?: string;
  modelMetadataIds?: number[];
  fieldMetadataIds?: number[];
  entityIds?: number[];
  repointFields?: boolean;
  overwriteExisting?: boolean;
  batchSize?: number;
  concurrency?: number;
}

interface ValidatedRequest {
  source: MediaStorageProviderMetadata;
  target: MediaStorageProviderMetadata;
  scope: MigrationScope;
  options: { repointFields: boolean; overwriteExisting: boolean; batchSize: number; concurrency: number };
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
    const sharedOutside = await sharedRowsOutsideScope(this.dataSource, scope, [...distinctFiles.keys()]);
    const nullSizeRows = await scopedMediaQuery(this.dataSource, scope).andWhere('media.fileSize IS NULL').getCount();

    const warnings: string[] = [];
    if (sameBucket) {
      warnings.push('No files are copied. S3 access is controlled by the bucket policy; this only changes how URLs are generated.');
    }
    if (source.isPublic === false && target.isPublic !== false) {
      warnings.push('Files from a private provider will become publicly reachable.');
    }
    if (sharedOutside.length > 0) {
      warnings.push(`${sharedOutside.length} media row(s) outside this scope use the same files. They will be moved too.`);
    }
    if (collisions.length > 0) {
      warnings.push(`${collisions.length} target file name(s) are shared by different source files. The migration will fail for those files until they are renamed.`);
    }
    if (nullSizeRows > 0) {
      warnings.push(`${nullSizeRows} media row(s) have no recorded size, so they are not included in the byte total.`);
    }

    const fieldsToRepoint = fields.map(field => ({ id: field.id, name: field.name, modelName: field.model?.singularName }));

    return {
      sourceProvider: source.name,
      targetProvider: target.name,
      sourceType: sourceLocationKind,
      sameLocation: sameBucket,
      totalFiles: distinctFiles.size,
      totalMediaRows,
      totalBytes: [...distinctFiles.values()].reduce((sum, size) => sum + size, 0),
      byField,
      fieldsToRepoint,
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
      entityIds: scope.entityIds?.length ? scope.entityIds : null,
      status: 'pending',
      repointFields: options.repointFields,
      overwriteExisting: options.overwriteExisting,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      totalCount: preview.totalFiles,
      totalBytes: preview.totalBytes,
      warnings: preview.warnings,
    } as any) as unknown as MediaMigrationJob);

    await this.publish(job.id);
    this.logger.log(`Queued media migration job ${job.id} (${source.name} -> ${target.name})`);
    return job;
  }

  // ---- control ----

  /** Stops a job. A pending job is cancelled at once; a running one stops after its current batch. */
  async cancel(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.loadJob(jobId);
    if (job.status === 'pending') {
      await this.updateJob(jobId, { status: 'cancelled', finishedAt: new Date() });
    } else if (job.status === 'running') {
      await this.updateJob(jobId, { status: 'cancelling' });
    } else {
      throw new BadRequestException(`Job #${jobId} is ${job.status} and cannot be cancelled.`);
    }
    return this.loadJob(jobId);
  }

  /** Continues a failed or cancelled job from where it stopped. */
  async resume(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.loadJob(jobId);
    const staleRunning = job.status === 'running' && (!job.leaseExpiresAt || job.leaseExpiresAt < new Date());
    if (!['failed', 'cancelled'].includes(job.status) && !staleRunning) {
      throw new BadRequestException(`Job #${jobId} is ${job.status} and cannot be resumed.`);
    }
    await this.updateJob(jobId, { status: 'pending', errorMessage: null, leaseToken: null, leaseExpiresAt: null });
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
    await this.updateJob(jobId, { status: 'rolled_back', finishedAt: new Date() });

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
        const stillUsed = await this.dataSource.getRepository(Media).createQueryBuilder('media').withDeleted()
          .innerJoin('media.mediaStorageProviderMetadata', 'provider')
          .where('provider.id = :sourceId', { sourceId: job.sourceProvider.id })
          .andWhere('media.relativeUri = :key', { key: item.sourceKey })
          .getCount();
        if (stillUsed > 0) {
          skipped.push({ itemId: item.id, reason: `${stillUsed} media row(s) still use the source file.` });
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

    const scope: MigrationScope = {
      sourceProviderId: source.id,
      modelMetadataIds: request.modelMetadataIds?.length ? request.modelMetadataIds : null,
      fieldMetadataIds: request.fieldMetadataIds?.length ? request.fieldMetadataIds : null,
      entityIds: request.entityIds?.length ? request.entityIds : null,
    };
    await this.assertScopeExists(scope);

    if (scope.entityIds) {
      const models = scope.modelMetadataIds?.length ?? 0;
      const fields = scope.fieldMetadataIds?.length ?? 0;
      if (!((models === 1 && fields === 0) || (models === 0 && fields === 1))) {
        throw new BadRequestException('entityIds needs exactly one model or exactly one field in scope, and no other scope filters.');
      }
    }

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
        repointFields: request.repointFields ?? true,
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
    if (scope.entityIds?.length) {
      const found = await this.dataSource.getRepository(Media).count({ where: { entityId: In(scope.entityIds) } });
      if (found === 0) {
        throw new BadRequestException('None of the entityIds have media on the source provider.');
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
