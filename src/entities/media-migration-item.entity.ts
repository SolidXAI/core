import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { MediaMigrationJob } from 'src/entities/media-migration-job.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { BigintToNumberTransformer } from 'src/transformers/typeorm/bigint-to-number-transformer';

export const MEDIA_MIGRATION_ITEM_STATUSES = [
  'pending',
  'completed',
  'skipped',
  'failed',
  'rolled_back',
  'source_deleted',
  'target_deleted',
] as const;
export type MediaMigrationItemStatus = typeof MEDIA_MIGRATION_ITEM_STATUSES[number];

// Longest file key stored per item. Bounded so it can be part of a unique index on every
// supported database (SQL Server limits index keys to 900 bytes). Longer keys are reported
// by the migration engine as a failed item instead of being cut off.
export const MEDIA_MIGRATION_KEY_MAX_LENGTH = 450;

/**
 * One unique source file within a migration job. Several media rows (for example
 * draft/publish versions) can share the same file, so they are recorded together here.
 */
@Entity('ss_media_migration_item')
@Index(['job', 'sourceKey'], { unique: true })
export class MediaMigrationItem extends CommonEntity {
  @ManyToOne(() => MediaMigrationJob, job => job.mediaMigrationItems, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  job: MediaMigrationJob;

  @Column({ type: 'varchar', length: MEDIA_MIGRATION_KEY_MAX_LENGTH })
  sourceKey: string;

  @Column({ type: 'varchar', length: MEDIA_MIGRATION_KEY_MAX_LENGTH, nullable: true })
  targetKey: string | null;

  // Media row ids whose provider and key this item switched.
  @Column({ type: 'simple-json', ...getColumnType('simpleJsonLargeText') })
  mediaIds: number[];

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status: MediaMigrationItemStatus;

  // True only if this job wrote the target file. Cleanup and rollback use it to avoid
  // deleting a file that existed before the job ran.
  @Column({ ...getColumnType('boolean'), default: false })
  copied: boolean;

  @Column({ nullable: true, ...getColumnType('bigint'), transformer: BigintToNumberTransformer })
  sourceSize: number | null;

  @Column({ nullable: true, ...getColumnType('bigint'), transformer: BigintToNumberTransformer })
  targetSize: number | null;

  @Column({ type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ nullable: true, ...getColumnType('longText') })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;
}
