import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

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

// bigint columns come back from some drivers as strings; return numbers instead.
export const bigintToNumber = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) => (value === null || value === undefined ? null : Number(value)),
};

/**
 * One migration run: moves media from a source provider to a target provider,
 * optionally limited to some models, fields or records.
 */
@Entity('ss_media_migration_job')
export class MediaMigrationJob extends CommonEntity {
  @Index()
  @ManyToOne(() => MediaStorageProviderMetadata, { nullable: false })
  @JoinColumn({ name: 'sourceProviderId' })
  sourceProvider: MediaStorageProviderMetadata;

  @Index()
  @ManyToOne(() => MediaStorageProviderMetadata, { nullable: false })
  @JoinColumn({ name: 'targetProviderId' })
  targetProvider: MediaStorageProviderMetadata;

  // Optional scope. Empty or null means "no filter on this dimension".
  @Column({ type: 'simple-json', nullable: true })
  modelMetadataIds: number[] | null;

  @Column({ type: 'simple-json', nullable: true })
  fieldMetadataIds: number[] | null;

  @Column({ type: 'simple-json', nullable: true })
  entityIds: number[] | null;

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status: MediaMigrationJobStatus;

  // Repoint the fields to the target provider once the job has no failures.
  @Column({ type: 'boolean', default: true })
  repointFields: boolean;

  // Replace a file at the target only if it differs from the source. Off by default.
  @Column({ type: 'boolean', default: false })
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

  @Column({ type: 'bigint', default: 0, transformer: bigintToNumber })
  totalBytes: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintToNumber })
  migratedBytes: number;

  // Keyset cursor: the highest media id processed so far. Lets a job resume.
  @Column({ type: 'int', default: 0 })
  lastProcessedMediaId: number;

  @Column({ type: 'simple-json', nullable: true })
  repointedFieldIds: number[] | null;

  @Column({ type: 'simple-json', nullable: true })
  updatedMetadataFiles: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  warnings: string[] | null;

  @Column({ type: 'varchar', nullable: true, ...getColumnType('longText') })
  errorMessage: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;
}
