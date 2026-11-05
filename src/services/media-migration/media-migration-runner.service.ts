import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { Media } from 'src/entities/media.entity';
import { MediaMigrationItem, MediaMigrationItemStatus, MEDIA_MIGRATION_KEY_MAX_LENGTH } from 'src/entities/media-migration-item.entity';
import { MediaMigrationJob, MediaMigrationJobStatus } from 'src/entities/media-migration-job.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { MediaTransferService } from './media-transfer.service';
import { MediaLocation, normalizeTargetKey, resolveLocation, sameLocation } from './media-location';
import { MigrationError, toMigrationError } from './migration-error';
import { itemKeyFor, rowsUsingLocation, runWithConcurrency, scopedMediaQuery } from './media-migration-scope';
import { MediaMigrationFieldsService } from './media-migration-fields.service';

export const LEASE_DURATION_MS = 10 * 60 * 1000;
const LEASE_RENEW_INTERVAL_MS = 60 * 1000;
const RUNNABLE_STATUSES: MediaMigrationJobStatus[] = ['pending', 'running'];
const MAX_REPORTED_UNRECORDED = 10;

export interface MigrationRunResult {
  jobId: number;
  status: MediaMigrationJobStatus | 'not_started';
  reason?: string;
}

type MediaRowForMigration = Pick<Media, 'id' | 'relativeUri' | 'mimeType'>;
type MediaStorageProviderLike = Pick<MediaStorageProviderMetadata, 'name' | 'type' | 'bucketName' | 'region' | 'isPublic'>;

// State of one run. Target names are claimed here, synchronously, so two files processed at the same
// moment can never both take the same name. Only one worker runs a job (the lease), so this is enough.
interface RunContext {
  job: MediaMigrationJob;
  token: string;
  claims: Map<string, string>;
  unrecorded: string[];
  unrecordedCount: number;
}

/**
 * Does the work of a media migration job: copies each file, switches its media rows to the
 * target provider, and records a result for every file. It can be stopped and resumed at any
 * batch boundary, and it never deletes or changes a source file.
 *
 * Only one worker runs a job at a time: it holds the job's lease, which is renewed while it works.
 */
@Injectable()
export class MediaMigrationRunnerService {
  private readonly logger = new Logger(MediaMigrationRunnerService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transfer: MediaTransferService,
    private readonly configService: ConfigService,
    private readonly fields: MediaMigrationFieldsService,
  ) { }

  /** Runs the job until it finishes, fails, or is cancelled. Never throws: failures are recorded on the job. */
  async run(jobId: number): Promise<MigrationRunResult> {
    const token = randomUUID();
    if (!(await this.acquireLease(jobId, token))) {
      return { jobId, status: 'not_started', reason: 'Job is already being run by another worker or is not runnable' };
    }

    const heartbeat = setInterval(() => {
      this.renewLease(jobId, token).catch(error => this.logger.warn(`Could not renew lease for job ${jobId}: ${error?.message}`));
    }, LEASE_RENEW_INTERVAL_MS);

    try {
      const job = await this.loadJob(jobId);
      const firstRun = job.startedAt === null;

      // Only start a job that is still pending or running: a cancel that arrived after the lease was taken wins.
      const started = await this.updateJobIf(jobId, token, RUNNABLE_STATUSES,
        { status: 'running', startedAt: job.startedAt ?? new Date(), errorMessage: null });
      if (!started) {
        return { jobId, status: 'not_started', reason: 'Job was cancelled or finished before it started' };
      }

      if (firstRun) {
        await this.recordTotals(job, token);
      }
      await this.checkBuckets(job);

      const context: RunContext = { job, token, claims: new Map(), unrecorded: [], unrecordedCount: 0 };
      const outcome = await this.processBatches(context);
      if (outcome === 'lease_lost') {
        return { jobId, status: 'not_started', reason: 'Lease was taken over by another worker' };
      }
      if (outcome === 'cancelled') {
        await this.updateJob(jobId, token, { status: 'cancelled', finishedAt: new Date() });
        return { jobId, status: 'cancelled' };
      }

      const counts = await this.refreshCounts(jobId, token);
      // Any file still pending, or a result that could not be saved, means the job is not clean.
      const problems = counts.failed + counts.pending + context.unrecordedCount;
      const finalStatus: MediaMigrationJobStatus = problems > 0 ? 'completed_with_errors' : 'completed';

      const warnings = [...(job.warnings ?? [])];
      if (context.unrecordedCount > 0) {
        warnings.push(
          `${context.unrecordedCount} file(s) could not be recorded because of a database error, so they were not migrated ` +
          `(for example: ${context.unrecorded.join(', ')}). Use retry-failed to try them again.`,
        );
      }

      // Fields move only when every file succeeded, so a half-migrated provider never takes new uploads.
      let repointed: Partial<MediaMigrationJob> = {};
      if (job.repointFields && finalStatus === 'completed') {
        const outcome = await this.repointJobFields(job);
        warnings.push(...outcome.warnings);
        repointed = { repointedFieldIds: outcome.movedFieldIds, updatedMetadataFiles: outcome.updatedMetadataFiles };
      }
      await this.updateJob(jobId, token, { status: finalStatus, finishedAt: new Date(), warnings, ...repointed });
      this.logger.log(`Media migration job ${jobId} finished: ${finalStatus} (${counts.completed} migrated, ${counts.failed} failed, ${counts.skipped} skipped)`);
      return { jobId, status: finalStatus };
    } catch (error: any) {
      const message = error?.message ?? String(error);
      this.logger.error(`Media migration job ${jobId} stopped: ${message}`);
      await this.updateJob(jobId, token, { status: 'failed', finishedAt: new Date(), errorMessage: message }).catch(() => undefined);
      return { jobId, status: 'failed', reason: message };
    } finally {
      clearInterval(heartbeat);
      await this.releaseLease(jobId, token);
    }
  }

  /**
   * Switches the fields of a finished job to the target provider, for jobs that did not do it when they
   * finished (created with repointFields off, or retried). Takes the job's lease, so it cannot run while
   * a worker is migrating the same job.
   */
  async repoint(jobId: number): Promise<{ jobId: number; movedFieldIds: number[]; updatedMetadataFiles: string[]; warnings: string[] }> {
    const token = randomUUID();
    if (!(await this.acquireLease(jobId, token, ['completed']))) {
      throw new MigrationError('PROVIDER_MISCONFIGURED', 'The job must be completed, and not already being run, before its fields can be switched.');
    }
    try {
      const job = await this.loadJob(jobId);
      const outcome = await this.repointJobFields(job);
      const warnings = [...(job.warnings ?? []).filter(w => !w.startsWith('Fields were not switched')), ...outcome.warnings];
      await this.updateJob(jobId, token, {
        warnings,
        repointedFieldIds: outcome.movedFieldIds,
        updatedMetadataFiles: outcome.updatedMetadataFiles,
      });
      return { jobId, ...outcome };
    } finally {
      await this.releaseLease(jobId, token);
    }
  }

  // Fields in the job's scope that still use the source provider, moved to the target provider.
  private async repointJobFields(job: MediaMigrationJob) {
    const fieldIds = await this.fields.findFieldsToMove(this.scopeOf(job));
    const moved = await this.fields.moveFields(fieldIds, job.sourceProvider.id, job.targetProvider);
    return { movedFieldIds: moved.movedFieldIds, updatedMetadataFiles: moved.updatedMetadataFiles, warnings: moved.warnings };
  }

  // ---- lease ----

  private async acquireLease(jobId: number, token: string, statuses: MediaMigrationJobStatus[] = RUNNABLE_STATUSES): Promise<boolean> {
    return this.dataSource.transaction(async manager => {
      const job = await manager.findOne(MediaMigrationJob, { where: { id: jobId }, lock: { mode: 'pessimistic_write' } });
      if (!job) return false;
      if (!statuses.includes(job.status)) return false;
      const now = new Date();
      if (job.leaseToken && job.leaseExpiresAt && job.leaseExpiresAt > now) return false;
      await manager.update(MediaMigrationJob, { id: jobId }, {
        leaseToken: token,
        leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
      });
      return true;
    });
  }

  private async renewLease(jobId: number, token: string): Promise<void> {
    await this.dataSource.getRepository(MediaMigrationJob).update(
      { id: jobId, leaseToken: token },
      { leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS) },
    );
  }

  private async releaseLease(jobId: number, token: string): Promise<void> {
    await this.dataSource.getRepository(MediaMigrationJob).update(
      { id: jobId, leaseToken: token },
      { leaseToken: null, leaseExpiresAt: null },
    ).catch(error => this.logger.warn(`Could not release lease for job ${jobId}: ${error?.message}`));
  }

  /** Writes job fields only while this worker still holds the lease. */
  private async updateJob(jobId: number, token: string, fields: Partial<MediaMigrationJob>): Promise<boolean> {
    const result = await this.dataSource.getRepository(MediaMigrationJob).update({ id: jobId, leaseToken: token }, fields as any);
    return (result.affected ?? 0) > 0;
  }

  /** Like updateJob, but only while the job is in one of the given statuses. */
  private async updateJobIf(jobId: number, token: string, statuses: MediaMigrationJobStatus[], fields: Partial<MediaMigrationJob>): Promise<boolean> {
    const result = await this.dataSource.getRepository(MediaMigrationJob).update(
      { id: jobId, leaseToken: token, status: In(statuses) },
      fields as any,
    );
    return (result.affected ?? 0) > 0;
  }

  // ---- job setup ----

  private async loadJob(jobId: number): Promise<MediaMigrationJob> {
    const job = await this.dataSource.getRepository(MediaMigrationJob).findOne({
      where: { id: jobId },
      relations: ['sourceProvider', 'targetProvider'],
    });
    if (!job) {
      throw new MigrationError('UNKNOWN', `Media migration job ${jobId} does not exist.`);
    }
    return job;
  }

  private scopeOf(job: MediaMigrationJob) {
    return {
      sourceProviderId: job.sourceProvider.id,
      modelMetadataIds: job.modelMetadataIds,
      fieldMetadataIds: job.fieldMetadataIds,
    };
  }

  // Counts the files and bytes in scope once, when the job first starts, so progress can be shown.
  private async recordTotals(job: MediaMigrationJob, token: string): Promise<void> {
    const rows: { relativeUri: string; size: string | null }[] = await scopedMediaQuery(this.dataSource, this.scopeOf(job))
      .select('media.relativeUri', 'relativeUri')
      .addSelect('MAX(media.fileSize)', 'size')
      .groupBy('media.relativeUri')
      .getRawMany();
    const totalBytes = rows.reduce((sum, row) => sum + Number(row.size ?? 0), 0);
    await this.updateJob(job.id, token, { totalCount: rows.length, totalBytes });
  }

  // Fails the run early, with one clear message, if a bucket cannot be reached.
  private async checkBuckets(job: MediaMigrationJob): Promise<void> {
    for (const [provider, role] of [[job.sourceProvider, 'source'], [job.targetProvider, 'target']] as const) {
      const location = this.bucketLocationOf(provider);
      if (location) {
        await this.transfer.assertBucketReachable(location, role);
      }
    }
  }

  // Location of a provider's bucket, used for bucket checks (no file name needed).
  private bucketLocationOf(provider: MediaStorageProviderLike): MediaLocation | null {
    if (provider.type === MediaStorageProviderType.AwsS3) {
      return resolveLocation(provider, '', this.defaultRegion());
    }
    return null;
  }

  private defaultRegion(): string | undefined {
    return this.configService.get<string>('S3_AWS_REGION_NAME') || undefined;
  }

  // ---- main loop ----

  private async processBatches(context: RunContext): Promise<'done' | 'cancelled' | 'lease_lost'> {
    const { job, token } = context;
    let cursor = job.lastProcessedMediaId ?? 0;
    const scope = this.scopeOf(job);

    while (true) {
      const control = await this.dataSource.getRepository(MediaMigrationJob).findOne({
        where: { id: job.id },
        select: ['id', 'status', 'leaseToken'],
      });
      if (!control || control.leaseToken !== token) return 'lease_lost';
      if (control.status === 'cancelling') return 'cancelled';

      const rows = await scopedMediaQuery(this.dataSource, scope)
        .andWhere('media.id > :cursor', { cursor })
        .select(['media.id', 'media.relativeUri', 'media.mimeType'])
        .orderBy('media.id', 'ASC')
        .take(job.batchSize)
        .getMany();
      if (rows.length === 0) break;

      const groups = new Map<string, MediaRowForMigration[]>();
      for (const row of rows) {
        groups.set(row.relativeUri, [...(groups.get(row.relativeUri) ?? []), row]);
      }

      await runWithConcurrency([...groups.entries()], job.concurrency, ([relativeUri, groupRows]) =>
        this.migrateFile(context, relativeUri, groupRows));

      cursor = Math.max(...rows.map(row => row.id));
      await this.updateJob(job.id, token, { lastProcessedMediaId: cursor });
      await this.refreshCounts(job.id, token);
    }
    return 'done';
  }

  // ---- one file ----

  /**
   * Migrates one stored file. Never throws, so one bad file cannot stop the others that are running
   * at the same time. A file whose result cannot even be saved is counted, and the job is then
   * reported as completed with errors instead of completed.
   */
  private async migrateFile(context: RunContext, sourceKey: string, rows: MediaRowForMigration[]): Promise<void> {
    try {
      await this.processFile(context, sourceKey, rows);
    } catch (error: any) {
      this.noteUnrecorded(context, sourceKey);
      this.logger.error(`Could not record the result for "${sourceKey.slice(0, 80)}": ${error?.message ?? error}`);
    }
  }

  private noteUnrecorded(context: RunContext, sourceKey: string): void {
    context.unrecordedCount += 1;
    if (context.unrecorded.length < MAX_REPORTED_UNRECORDED) {
      context.unrecorded.push(`"${sourceKey.slice(0, 80)}"`);
    }
  }

  // Copies the file, switches every media row that uses it, and records the outcome on its item.
  private async processFile(context: RunContext, sourceKey: string, rows: MediaRowForMigration[]): Promise<void> {
    const { job } = context;
    const mediaIds = rows.map(row => row.id);
    const identity = itemKeyFor(sourceKey);
    const item = await this.findOrCreateItem(job.id, identity, mediaIds);
    let claimedTarget: string | null = null;

    try {
      // A key too long to record cannot be tracked or rolled back safely, so it is never migrated.
      if (sourceKey.length > MEDIA_MIGRATION_KEY_MAX_LENGTH) {
        throw new MigrationError(
          'INVALID_FILE_KEY',
          `The file name "${sourceKey.slice(0, 60)}..." is longer than ${MEDIA_MIGRATION_KEY_MAX_LENGTH} characters and cannot be migrated.`,
        );
      }

      const targetKey = normalizeTargetKey(sourceKey);
      this.claimTarget(context, identity, targetKey);
      claimedTarget = targetKey;
      await this.assertNoOtherItemClaimsTarget(job.id, identity, targetKey);

      item.targetKey = targetKey;
      item.attempts = (item.attempts ?? 0) + 1;
      await this.saveItem(item);

      const defaultRegion = this.defaultRegion();
      const source = resolveLocation(job.sourceProvider, sourceKey, defaultRegion);
      const target = resolveLocation(job.targetProvider, targetKey, defaultRegion);

      if (sameLocation(source, target)) {
        // Same stored object, for example an S3 bucket where only the public/private flag changes.
        await this.switchRows(job, sourceKey, targetKey, item);
        return;
      }

      const sourceStat = await this.transfer.stat(source, 'source');
      if (!sourceStat) {
        throw new MigrationError('SOURCE_NOT_FOUND', `Source file "${sourceKey}" was not found. It may have been deleted outside SolidX.`);
      }
      item.sourceSize = sourceStat.size;

      await this.copyIfNeeded(job, item, source, target, sourceKey, targetKey, sourceStat.size, rows[0]?.mimeType ?? undefined);

      const verify = await this.transfer.stat(target, 'target');
      if (!verify || verify.size !== sourceStat.size) {
        if (item.copied) {
          await this.transfer.delete(target).catch(() => undefined);
        }
        throw new MigrationError(
          'SIZE_MISMATCH',
          `Copied "${sourceKey}" but the target size is ${verify?.size ?? 'missing'} bytes instead of ${sourceStat.size}. The partial copy was removed; retry the job.`,
        );
      }
      item.targetSize = verify.size;
      await this.switchRows(job, sourceKey, targetKey, item);
    } catch (error) {
      if (claimedTarget) {
        this.releaseTarget(context, identity, claimedTarget);
      }
      const migrationError = error instanceof MigrationError
        ? error
        : toMigrationError(error, 'target', `"${sourceKey.slice(0, 80)}"`);
      await this.recordFailure(context, item, migrationError, mediaIds);
    }
  }

  // Copies the file unless the target already holds the same file. A same-named file of the same size
  // is only trusted if its content matches, because the same size does not mean the same file.
  private async copyIfNeeded(
    job: MediaMigrationJob, item: MediaMigrationItem, source: MediaLocation, target: MediaLocation,
    sourceKey: string, targetKey: string, sourceSize: number, contentType?: string,
  ): Promise<void> {
    const targetStat = await this.transfer.stat(target, 'target');

    if (targetStat && targetStat.size === sourceSize) {
      // Written by this job earlier (a retry or resume), or the very same file: nothing to copy.
      if (item.copied || await this.transfer.sameContent(source, target)) {
        return;
      }
      if (!job.overwriteExisting) {
        throw new MigrationError(
          'TARGET_KEY_CONFLICT',
          `"${targetKey}" already exists on the target with the same size as "${sourceKey}" but different content. ` +
          `Rename or remove that file, or rerun the job with overwriteExisting.`,
        );
      }
    } else if (targetStat && !job.overwriteExisting) {
      throw new MigrationError(
        'TARGET_KEY_CONFLICT',
        `"${targetKey}" already exists on the target with a different size (${targetStat.size} bytes instead of ${sourceSize}). ` +
        `Rename or remove that file, or rerun the job with overwriteExisting.`,
      );
    }

    await this.transfer.copy(source, target, { sourceSize, contentType });
    item.copied = true;
    await this.saveItem(item);
  }

  private async findOrCreateItem(jobId: number, identity: string, mediaIds: number[]): Promise<MediaMigrationItem> {
    const repo = this.dataSource.getRepository(MediaMigrationItem);
    const existing = await repo.findOne({ where: { job: { id: jobId }, sourceKey: identity } });
    if (existing) {
      return existing;
    }
    const item = repo.create({
      job: { id: jobId } as MediaMigrationJob,
      sourceKey: identity,
      targetKey: null,
      mediaIds,
      status: 'pending',
      copied: false,
      attempts: 0,
    } as any) as unknown as MediaMigrationItem;
    try {
      return await repo.save(item);
    } catch (error) {
      // Lost a race with an identical insert: use the row that won.
      const winner = await repo.findOne({ where: { job: { id: jobId }, sourceKey: identity } });
      if (winner) return winner;
      throw error;
    }
  }

  // Two different source files must never be copied to the same target name in one job.
  // Claimed in memory first (synchronously, so files running at the same moment cannot both pass),
  // then checked against files recorded by earlier batches and runs.
  private claimTarget(context: RunContext, identity: string, targetKey: string): void {
    const owner = context.claims.get(targetKey);
    if (owner !== undefined && owner !== identity) {
      throw new MigrationError(
        'TARGET_KEY_CONFLICT',
        `"${identity}" and "${owner}" would both be stored as "${targetKey}". Rename one of the files before migrating.`,
      );
    }
    context.claims.set(targetKey, identity);
  }

  private releaseTarget(context: RunContext, identity: string, targetKey: string): void {
    if (context.claims.get(targetKey) === identity) {
      context.claims.delete(targetKey);
    }
  }

  private async assertNoOtherItemClaimsTarget(jobId: number, identity: string, targetKey: string): Promise<void> {
    const other = await this.dataSource.getRepository(MediaMigrationItem).createQueryBuilder('item')
      .innerJoin('item.job', 'job')
      .where('job.id = :jobId', { jobId })
      .andWhere('item.targetKey = :targetKey', { targetKey })
      .andWhere('item.sourceKey <> :identity', { identity })
      .andWhere('item.status NOT IN (:...inactive)', { inactive: ['failed', 'skipped', 'rolled_back'] })
      .getOne();
    if (other) {
      throw new MigrationError(
        'TARGET_KEY_CONFLICT',
        `"${identity}" and "${other.sourceKey}" would both be stored as "${targetKey}". Rename one of the files before migrating.`,
      );
    }
  }

  // Switches every row that uses this file, in scope or not, to the target, and records the result on
  // the item in the same transaction. If anything fails, neither the rows nor the item change, so the
  // job's records always match where the rows are.
  private async switchRows(job: MediaMigrationJob, sourceKey: string, targetKey: string, item: MediaMigrationItem): Promise<void> {
    const switched = await this.dataSource.transaction(async (manager: EntityManager) => {
      const rows = await manager.getRepository(Media).createQueryBuilder('media').withDeleted()
        .innerJoin('media.mediaStorageProviderMetadata', 'source')
        .where('source.id = :sourceId', { sourceId: job.sourceProvider.id })
        .andWhere('media.relativeUri = :sourceKey', { sourceKey })
        .select(['media.id'])
        .getMany();

      if (rows.length === 0) {
        // Every row was deleted while the file was copied, so nothing refers to the copy.
        item.status = 'skipped';
        item.errorCode = 'ROW_DELETED_DURING_MIGRATION';
        item.errorMessage = `Media rows for "${sourceKey}" were deleted while the file was being copied; nothing needed migrating.`;
        await manager.getRepository(MediaMigrationItem).save(item);
        return [];
      }

      const ids = rows.map(row => row.id);
      await manager.createQueryBuilder()
        .update(Media)
        .set({ mediaStorageProviderMetadata: { id: job.targetProvider.id } as any, relativeUri: targetKey })
        .where('id IN (:...ids)', { ids })
        .execute();

      item.mediaIds = ids;
      item.status = 'completed';
      item.errorCode = null;
      item.errorMessage = null;
      await manager.getRepository(MediaMigrationItem).save(item);
      return ids;
    });

    if (switched.length === 0 && item.copied) {
      // Remove the copy this job made, unless a row has meanwhile started to use it.
      const target = resolveLocation(job.targetProvider, targetKey, this.defaultRegion());
      if ((await rowsUsingLocation(this.dataSource, target, this.defaultRegion())).length === 0) {
        await this.transfer.delete(target).catch(() => undefined);
      }
    }
  }

  private async recordFailure(context: RunContext, item: MediaMigrationItem, error: MigrationError, mediaIds: number[]): Promise<void> {
    item.status = 'failed';
    item.errorCode = error.code;
    item.errorMessage = `${error.message} (media ids: ${mediaIds.join(', ')})`;
    this.logger.warn(`Media file "${item.sourceKey.slice(0, 80)}" failed (${error.code}): ${error.message}`);
    try {
      await this.saveItem(item);
    } catch (saveError: any) {
      // The failure itself could not be saved: the job must not look clean.
      this.noteUnrecorded(context, item.sourceKey);
      this.logger.error(`Could not record failure for "${item.sourceKey.slice(0, 80)}": ${saveError?.message}`);
    }
  }

  private async saveItem(item: MediaMigrationItem): Promise<void> {
    await this.dataSource.getRepository(MediaMigrationItem).save(item);
  }

  // ---- counts ----

  // Job counts are always recomputed from the file records, so they cannot drift.
  private async refreshCounts(jobId: number, token: string): Promise<{ completed: number; failed: number; skipped: number; pending: number }> {
    const items = this.dataSource.getRepository(MediaMigrationItem);
    const countWith = (status: MediaMigrationItemStatus) =>
      items.count({ where: { job: { id: jobId }, status } });

    const [completed, failed, skipped, pending] = await Promise.all([
      countWith('completed'), countWith('failed'), countWith('skipped'), countWith('pending'),
    ]);
    const bytes = await items.createQueryBuilder('item')
      .select('COALESCE(SUM(item.sourceSize), 0)', 'bytes')
      .innerJoin('item.job', 'job')
      .where('job.id = :jobId', { jobId })
      .andWhere('item.status = :status', { status: 'completed' })
      .getRawOne();

    await this.updateJob(jobId, token, {
      migratedCount: completed,
      failedCount: failed,
      skippedCount: skipped,
      migratedBytes: Number(bytes?.bytes ?? 0),
    });
    return { completed, failed, skipped, pending };
  }
}
