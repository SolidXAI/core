import { createHash } from 'crypto';
import { SelectQueryBuilder } from 'typeorm';

/**
 * Builds a deterministic cache key from the model name and the fully resolved
 * QueryBuilder SQL + bound parameters.
 *
 * Format: solidx:{modelName}:{sha256(sql::params)}
 *
 * Full SHA-256 (64 hex chars) is used intentionally — a collision would silently
 * serve wrong data, so truncation is not acceptable.
 */
export function buildCacheKey(modelName: string, qb: SelectQueryBuilder<any>): string {
    const raw = qb.getSql() + '::' + JSON.stringify(qb.getParameters());
    const hash = createHash('sha256').update(raw).digest('hex');
    return `solidx:${modelName}:${hash}`;
}
