import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import type { MediaMigrationItem } from 'src/entities/media-migration-item.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { BigintToNumberTransformer } from 'src/transformers/typeorm/bigint-to-number-transformer';

export const MEDIA_MIGRATION_JOB_STATUSES = [
  'pending',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelling',
  'cancelled',
  'rolled_back',
] as const;
export type MediaMigrationJobStatus = typeof MEDIA_MIGRATION_JOB_STATUSES[number];

/**
 * One migration run: moves media from a source provider to a target provider,
 * optionally limited to some models, fields or records.
 */
@Entity('ss_media_migration_job')
export class MediaMigrationJob extends CommonEntity {
  // Providers are kept (restrict) so job history is never left pointing at nothing.
  @Index()
  @ManyToOne(() => MediaStorageProviderMetadata, { nullable: false })
  @JoinColumn()
  sourceProvider: MediaStorageProviderMetadata;

  @Index()
  @ManyToOne(() => MediaStorageProviderMetadata, { nullable: false })
  @JoinColumn()
  targetProvider: MediaStorageProviderMetadata;

  // Optional scope. Null or empty means "no filter on this dimension".
  @Column({ type: 'simple-json', nullable: true, ...getColumnType('simpleJsonLargeText') })
  modelMetadataIds: number[] | null;

  @Column({ type: 'simple-json', nullable: true, ...getColumnType('simpleJsonLargeText') })
  fieldMetadataIds: number[] | null;

  @Column({ type: 'simple-json', nullable: true, ...getColumnType('simpleJsonLargeText') })
  entityIds: number[] | null;

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status: MediaMigrationJobStatus;

  // Repoint the fields to the target provider once the job has no failures.
  @Column({ ...getColumnType('boolean'), default: true })
  repointFields: boolean;

  // Replace a file at the target only if it differs from the source. Off by default.
  @Column({ ...getColumnType('boolean'), default: false })
  overwriteExisting: boolean;

  @Column({ type: 'int', default: 200 })
  batchSize: number;

  @Column({ type: 'int', default: 4 })
  concurrency: number;

  // Counts are in files (unique source keys), not media rows.
  @Column({ type: 'int', default: 0 })
  totalCount: number;

  @Column({ type: 'int', default: 0 })
  migratedCount: number;

  @Column({ type: 'int', default: 0 })
  skippedCount: number;

  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @Column({ ...getColumnType('bigint'), default: 0, transformer: BigintToNumberTransformer })
  totalBytes: number;

  @Column({ ...getColumnType('bigint'), default: 0, transformer: BigintToNumberTransformer })
  migratedBytes: number;

  // Keyset cursor: the highest media id processed so far. Lets a job resume.
  @Column({ type: 'int', default: 0 })
  lastProcessedMediaId: number;

  @Column({ type: 'simple-json', nullable: true, ...getColumnType('simpleJsonLargeText') })
  repointedFieldIds: number[] | null;

  @Column({ type: 'simple-json', nullable: true, ...getColumnType('simpleJsonLargeText') })
  updatedMetadataFiles: string[] | null;

  @Column({ type: 'simple-json', nullable: true, ...getColumnType('simpleJsonLargeText') })
  warnings: string[] | null;

  @Column({ nullable: true, ...getColumnType('longText') })
  errorMessage: string | null;

  @Column({ nullable: true, ...getColumnType('datetime') })
  startedAt: Date | null;

  @Column({ nullable: true, ...getColumnType('datetime') })
  finishedAt: Date | null;

  // Lease held by the worker running this job. Only the holder may change the job. An expired
  // lease means the worker stopped (for example, the process restarted) and the job can be resumed.
  @Column({ type: 'varchar', length: 64, nullable: true })
  leaseToken: string | null;

  @Column({ nullable: true, ...getColumnType('datetime') })
  leaseExpiresAt: Date | null;

  @OneToMany('MediaMigrationItem', (item: MediaMigrationItem) => item.job)
  mediaMigrationItems: MediaMigrationItem[];
}
