import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Media } from 'src/entities/media.entity';
import { MEDIA_MIGRATION_KEY_MAX_LENGTH } from 'src/entities/media-migration-item.entity';
import * as crypto from 'crypto';

export interface MigrationScope {
  sourceProviderId: number;
  modelMetadataIds?: number[] | null;
  fieldMetadataIds?: number[] | null;
  entityIds?: number[] | null;
}

/**
 * Media rows on the source provider that match the scope. Soft-deleted rows are included:
 * their files still need to move, and cleanup must see them so it never deletes a file they use.
 */
export function scopedMediaQuery(dataSource: DataSource, scope: MigrationScope, alias = 'media'): SelectQueryBuilder<Media> {
  // Model and field are joined under fixed aliases (scopeModel, scopeField) so callers can group by them.
  const qb = dataSource.getRepository(Media).createQueryBuilder(alias).withDeleted()
    .innerJoin(`${alias}.mediaStorageProviderMetadata`, 'source')
    .leftJoin(`${alias}.modelMetadata`, 'scopeModel')
    .leftJoin(`${alias}.fieldMetadata`, 'scopeField')
    .where('source.id = :sourceProviderId', { sourceProviderId: scope.sourceProviderId });

  if (scope.modelMetadataIds?.length) {
    qb.andWhere('scopeModel.id IN (:...modelIds)', { modelIds: scope.modelMetadataIds });
  }
  if (scope.fieldMetadataIds?.length) {
    qb.andWhere('scopeField.id IN (:...fieldIds)', { fieldIds: scope.fieldMetadataIds });
  }
  if (scope.entityIds?.length) {
    qb.andWhere(`${alias}.entityId IN (:...entityIds)`, { entityIds: scope.entityIds });
  }
  return qb;
}

/**
 * Rows on the source provider whose file is also used by a row in the scope but are outside it,
 * such as a draft/publish version. Moving the file moves them too, so the run reports them.
 */
export function sharedRowsOutsideScope(dataSource: DataSource, scope: MigrationScope, fileKeys: string[]): Promise<Media[]> {
  if (fileKeys.length === 0) {
    return Promise.resolve([]);
  }
  return dataSource.getRepository(Media).createQueryBuilder('media').withDeleted()
    .innerJoin('media.mediaStorageProviderMetadata', 'source')
    .leftJoinAndSelect('media.modelMetadata', 'modelMetadata')
    .leftJoinAndSelect('media.fieldMetadata', 'fieldMetadata')
    .where('source.id = :sourceProviderId', { sourceProviderId: scope.sourceProviderId })
    .andWhere('media.relativeUri IN (:...keys)', { keys: fileKeys })
    .getMany()
    .then(rows => rows.filter(row => !matchesScope(row, scope)));
}

function matchesScope(row: Media, scope: MigrationScope): boolean {
  const modelIds = scope.modelMetadataIds ?? [];
  const fieldIds = scope.fieldMetadataIds ?? [];
  const entityIds = scope.entityIds ?? [];
  if (modelIds.length && !modelIds.includes(row.modelMetadata?.id)) return false;
  if (fieldIds.length && !fieldIds.includes(row.fieldMetadata?.id)) return false;
  if (entityIds.length && !entityIds.includes(row.entityId)) return false;
  return true;
}

/**
 * Identifier of a file's migration item. Normal keys are used as they are. A key too long for the
 * item column gets a shortened, hashed identifier, so it still has one item that can be reported.
 */
export function itemKeyFor(relativeUri: string): string {
  if (relativeUri.length <= MEDIA_MIGRATION_KEY_MAX_LENGTH) {
    return relativeUri;
  }
  const hash = crypto.createHash('sha1').update(relativeUri).digest('hex');
  return `${relativeUri.slice(0, MEDIA_MIGRATION_KEY_MAX_LENGTH - hash.length - 1)}~${hash}`;
}

/** Runs `fn` over `items` with at most `limit` running at once. `fn` must not throw. */
export async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}
