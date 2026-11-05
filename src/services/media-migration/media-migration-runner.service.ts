import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { Media } from 'src/entities/media.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { MediaStorageProviderType } from 'src/dtos/create-media-storage-provider-metadata.dto';
import { MediaMigrationItem, MediaMigrationItemStatus } from 'src/entities/media-migration-item.entity';
import { MediaMigrationJob, MediaMigrationJobStatus } from 'src/entities/media-migration-job.entity';
import { MediaTransferService } from './media-transfer.service';
import { MediaLocation, normalizeTargetKey, resolveLocation, sameLocation } from './media-location';
import { MigrationError, toMigrationError } from './migration-error';
import { itemKeyFor, runWithConcurrency, scopedMediaQuery } from './media-migration-scope';

export const LEASE_DURATION_MS = 10 * 60 * 1000;
const LEASE_RENEW_INTERVAL_MS = 60 * 1000;

export interface MigrationRunResult {
  jobId: number;
  status: MediaMigrationJobStatus | 'not_started';
  reason?: string;
}

type MediaRowForMigration = Pick<Media, 'id' | 'relativeUri' | 'mimeType'>;

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
      await this.updateJob(jobId, token, { status: 'running', startedAt: job.startedAt ?? new Date(), errorMessage: null });

      if (firstRun) {
        await this.recordTotals(job, token);
      }
      await this.checkBuckets(job);

      const outcome = await this.processBatches(job, token);
      if (outcome === 'lease_lost') {
        return { jobId, status: 'not_started', reason: 'Lease was taken over by another worker' };
      }
      if (outcome === 'cancelled') {
        await this.updateJob(jobId, token, { status: 'cancelled', finishedAt: new Date() });
        return { jobId, status: 'cancelled' };
      }

      const counts = await this.refreshCounts(jobId, token);
      const finalStatus: MediaMigrationJobStatus = counts.failed > 0 ? 'completed_with_errors' : 'completed';
      const warnings = [...(job.warnings ?? [])];
      if (job.repointFields && finalStatus === 'completed') {
        // Repointing the fields' provider is not built yet. Say so, rather than skip it silently.
        warnings.push('Fields were not switched to the target provider. New uploads still go to the source provider until the fields are changed.');
      }
      await this.updateJob(jobId, token, { status: finalStatus, finishedAt: new Date(), warnings });
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

  // ---- lease ----

  private async acquireLease(jobId: number, token: string): Promise<boolean> {
    return this.dataSource.transaction(async manager => {
      const job = await manager.findOne(MediaMigrationJob, { where: { id: jobId }, lock: { mode: 'pessimistic_write' } });
      if (!job) return false;
      if (!['pending', 'running'].includes(job.status)) return false;
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
      entityIds: job.entityIds,
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
      const location = this.locationOf(provider, null);
      if (location) {
        await this.transfer.assertBucketReachable(location, role);
      }
    }
  }

  // Location of a provider's bucket or folder, used for bucket checks (no file name needed).
  private locationOf(provider: MediaStorageProviderLike, relativeUri: string | null): MediaLocation | null {
    if (provider.type === MediaStorageProviderType.AwsS3) {
      return resolveLocation(provider, relativeUri ?? '', this.defaultRegion());
    }
    return null;
  }

  private defaultRegion(): string | undefined {
    return this.configService.get<string>('S3_AWS_REGION_NAME') || undefined;
  }

  // ---- main loop ----

  private async processBatches(job: MediaMigrationJob, token: string): Promise<'done' | 'cancelled' | 'lease_lost'> {
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
        this.migrateFile(job, relativeUri, groupRows, token));

      cursor = Math.max(...rows.map(row => row.id));
      await this.updateJob(job.id, token, { lastProcessedMediaId: cursor });
      await this.refreshCounts(job.id, token);
    }
    return 'done';
  }

  // ---- one file ----

  /**
   * Migrates one stored file and switches every media row that uses it. Records the outcome on the
   * file's item. Never throws: a failure is recorded and the run moves on to the next file.
   */
  private async migrateFile(job: MediaMigrationJob, sourceKey: string, rows: MediaRowForMigration[], token: string): Promise<void> {
    const mediaIds = rows.map(row => row.id);
    const identity = itemKeyFor(sourceKey);
    const item = await this.findOrCreateItem(job.id, identity, sourceKey, mediaIds);

    try {
      const targetKey = normalizeTargetKey(sourceKey);
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

      const targetStat = await this.transfer.stat(target, 'target');
      if (targetStat && targetStat.size === sourceStat.size) {
        // Already copied (an earlier run or retry). Only the rows need switching.
      } else if (targetStat && !job.overwriteExisting) {
        throw new MigrationError(
          'TARGET_KEY_CONFLICT',
          `"${targetKey}" already exists on the target with a different size (${targetStat.size} bytes instead of ${sourceStat.size}). ` +
          `Rename or remove that file, or rerun the job with overwriteExisting.`,
        );
      } else {
        await this.transfer.copy(source, target, { sourceSize: sourceStat.size, contentType: rows[0]?.mimeType ?? undefined });
        item.copied = true;
        await this.saveItem(item);
      }

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
      const migrationError = error instanceof MigrationError
        ? error
        : toMigrationError(error, 'target', `"${sourceKey}"`);
      await this.recordFailure(item, migrationError, mediaIds);
    }
  }

  private async findOrCreateItem(jobId: number, identity: string, sourceKey: string, mediaIds: number[]): Promise<MediaMigrationItem> {
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

  // Switches every row that uses this file, in scope or not, to the target. All or nothing.
  private async switchRows(job: MediaMigrationJob, sourceKey: string, targetKey: string, item: MediaMigrationItem): Promise<void> {
    const switched = await this.dataSource.transaction(async (manager: EntityManager) => {
      const rows = await manager.getRepository(Media).createQueryBuilder('media').withDeleted()
        .innerJoin('media.mediaStorageProviderMetadata', 'source')
        .where('source.id = :sourceId', { sourceId: job.sourceProvider.id })
        .andWhere('media.relativeUri = :sourceKey', { sourceKey })
        .select(['media.id'])
        .getMany();
      if (rows.length === 0) {
        return [];
      }
      const ids = rows.map(row => row.id);
      await manager.createQueryBuilder()
        .update(Media)
        .set({ mediaStorageProviderMetadata: { id: job.targetProvider.id } as any, relativeUri: targetKey })
        .where('id IN (:...ids)', { ids })
        .execute();
      return ids;
    });

    if (switched.length === 0) {
      // Every row was deleted while the file was copied, so nothing refers to the copy.
      if (item.copied && !(await this.rowsUseFile(job.targetProvider.id, targetKey))) {
        await this.transfer.delete(resolveLocation(job.targetProvider, targetKey, this.defaultRegion())).catch(() => undefined);
      }
      item.status = 'skipped';
      item.errorCode = 'ROW_DELETED_DURING_MIGRATION';
      item.errorMessage = `Media rows for "${sourceKey}" were deleted while the file was being copied; nothing needed migrating.`;
      await this.saveItem(item);
      return;
    }

    item.mediaIds = switched;
    item.status = 'completed';
    item.errorCode = null;
    item.errorMessage = null;
    await this.saveItem(item);
  }

  private async rowsUseFile(providerId: number, relativeUri: string): Promise<boolean> {
    return this.dataSource.getRepository(Media).createQueryBuilder('media').withDeleted()
      .innerJoin('media.mediaStorageProviderMetadata', 'provider')
      .where('provider.id = :providerId', { providerId })
      .andWhere('media.relativeUri = :relativeUri', { relativeUri })
      .getCount()
      .then(count => count > 0);
  }

  private async recordFailure(item: MediaMigrationItem, error: MigrationError, mediaIds: number[]): Promise<void> {
    item.status = 'failed';
    item.errorCode = error.code;
    item.errorMessage = `${error.message} (media ids: ${mediaIds.join(', ')})`;
    await this.saveItem(item).catch(saveError =>
      this.logger.error(`Could not record failure for "${item.sourceKey}": ${saveError?.message}`));
    this.logger.warn(`Media file "${item.sourceKey}" failed (${error.code}): ${error.message}`);
  }

  private async saveItem(item: MediaMigrationItem): Promise<void> {
    await this.dataSource.getRepository(MediaMigrationItem).save(item);
  }

  // ---- counts ----

  // Job counts are always recomputed from the file records, so they cannot drift.
  private async refreshCounts(jobId: number, token: string): Promise<{ completed: number; failed: number; skipped: number }> {
    const items = this.dataSource.getRepository(MediaMigrationItem);
    const countWith = (status: MediaMigrationItemStatus) =>
      items.count({ where: { job: { id: jobId }, status } });

    const [completed, failed, skipped] = await Promise.all([countWith('completed'), countWith('failed'), countWith('skipped')]);
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
    return { completed, failed, skipped };
  }
}

type MediaStorageProviderLike = Pick<MediaStorageProviderMetadata, 'name' | 'type' | 'bucketName' | 'region' | 'isPublic'>;
