import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { MediaMigrationJob, bigintToNumber } from 'src/entities/media-migration-job.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

export const MEDIA_MIGRATION_ITEM_STATUSES = [
  'pending',
  'completed',
  'skipped',
  'failed',
  'rolled_back',
  'source_deleted',
] as const;
export type MediaMigrationItemStatus = typeof MEDIA_MIGRATION_ITEM_STATUSES[number];

/**
 * One unique source file within a migration job. Several media rows (for example
 * draft/publish versions) can share the same file, so they are recorded together here.
 */
@Entity('ss_media_migration_item')
@Index(['jobId', 'sourceKey'], { unique: true })
export class MediaMigrationItem extends CommonEntity {
  @Index()
  @Column({ type: 'int' })
  jobId: number;

  @ManyToOne(() => MediaMigrationJob, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: MediaMigrationJob;

  @Column({ type: 'varchar', length: 255 })
  sourceKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetKey: string | null;

  // Media row ids whose provider and key this item switched.
  @Column({ type: 'simple-json' })
  mediaIds: number[];

  @Index()
  @Column({ type: 'varchar', default: 'pending' })
  status: MediaMigrationItemStatus;

  // True only if this job wrote the target file. Cleanup and rollback use it to avoid
  // deleting a file that existed before the job ran.
  @Column({ type: 'boolean', default: false })
  copied: boolean;

  @Column({ type: 'bigint', nullable: true, transformer: bigintToNumber })
  sourceSize: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintToNumber })
  targetSize: number | null;

  @Column({ type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ type: 'varchar', nullable: true, ...getColumnType('longText') })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;
}
