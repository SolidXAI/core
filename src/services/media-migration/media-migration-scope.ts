import { DataSource, SelectQueryBuilder } from 'typeorm';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { Media } from 'src/entities/media.entity';
import { MEDIA_MIGRATION_KEY_MAX_LENGTH } from 'src/entities/media-migration-item.entity';
import * as crypto from 'crypto';
import { equivalentKeys, MediaLocation, resolveLocation, sameLocation } from './media-location';

export interface MigrationScope {
  sourceProviderId: number;
  modelMetadataIds?: number[] | null;
  fieldMetadataIds?: number[] | null;
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
  return qb;
}

/**
 * How many rows on the source provider use a file that is also used by a row in the scope but are
 * outside it, such as a draft/publish version. Moving the file moves them too, so the preview reports
 * them. Counted in the database: a whole-provider scope has no "outside", and a narrower one never
 * passes file names as query parameters, which would fail above the database's parameter limit.
 */
export async function countSharedRowsOutsideScope(dataSource: DataSource, scope: MigrationScope): Promise<number> {
  if (!scope.modelMetadataIds?.length && !scope.fieldMetadataIds?.length) {
    return 0;
  }
  const scopedKeys = scopedMediaQuery(dataSource, scope, 'scopedKeys').select('scopedKeys.relativeUri');
  const scopedIds = scopedMediaQuery(dataSource, scope, 'scopedIds').select('scopedIds.id');
  return dataSource.getRepository(Media).createQueryBuilder('media').withDeleted()
    .innerJoin('media.mediaStorageProviderMetadata', 'sourceProvider')
    .where('sourceProvider.id = :sourceProviderId', { sourceProviderId: scope.sourceProviderId })
    .andWhere(`media.relativeUri IN (${scopedKeys.getQuery()})`)
    .andWhere(`media.id NOT IN (${scopedIds.getQuery()})`)
    .setParameters(scopedKeys.getParameters())
    .getCount();
}

/**
 * Every media row, on any provider, that uses this stored file. A row counts if its own provider and
 * key resolve to the same file, however the key is spelled and whichever provider record it uses
 * (for example two S3 providers on one bucket). Soft-deleted rows are included.
 */
export async function rowsUsingLocation(
  dataSource: DataSource,
  location: MediaLocation,
  defaultRegion?: string,
): Promise<Media[]> {
  const rows = await dataSource.getRepository(Media).createQueryBuilder('media').withDeleted()
    .innerJoinAndSelect('media.mediaStorageProviderMetadata', 'provider')
    .where('media.relativeUri IN (:...keys)', { keys: equivalentKeys(location) })
    .getMany();
  return rows.filter(row => {
    try {
      return sameLocation(resolveLocation(row.mediaStorageProviderMetadata, row.relativeUri, defaultRegion), location);
    } catch {
      return false; // a provider that cannot be resolved cannot be using this file
    }
  });
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

export interface MediaFieldOnProvider {
  id: number;
  name: string;
  modelName: string;
  isSystem: boolean;
}

const MEDIA_FIELD_TYPES = ['mediaSingle', 'mediaMultiple'];

/**
 * Media fields, within the scope, whose storage provider is the source provider. A job does not change
 * these; they are reported so that linking them to the target provider is not forgotten.
 */
export async function findMediaFieldsOnProvider(dataSource: DataSource, scope: MigrationScope): Promise<MediaFieldOnProvider[]> {
  const qb = dataSource.getRepository(FieldMetadata).createQueryBuilder('field')
    .innerJoin('field.mediaStorageProvider', 'provider')
    .innerJoin('field.model', 'model')
    .select(['field.id', 'field.name', 'field.isSystem', 'model.singularName'])
    .where('provider.id = :providerId', { providerId: scope.sourceProviderId })
    .andWhere('field.type IN (:...types)', { types: MEDIA_FIELD_TYPES });
  if (scope.fieldMetadataIds?.length) {
    qb.andWhere('field.id IN (:...fieldIds)', { fieldIds: scope.fieldMetadataIds });
  }
  if (scope.modelMetadataIds?.length) {
    qb.andWhere('model.id IN (:...modelIds)', { modelIds: scope.modelMetadataIds });
  }
  const fields = await qb.getMany();
  return fields.map(field => ({
    id: field.id,
    name: field.name,
    modelName: field.model?.singularName ?? '',
    isSystem: !!field.isSystem,
  }));
}
