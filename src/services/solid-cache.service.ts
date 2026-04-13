import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { isRedisConfigured } from 'src/helpers/environment.helper';

export interface CacheConfig {
    cacheEnabled: boolean;
    cacheStrategy: 'ttl' | 'onReboot';
    cacheTtl: number; // seconds. -1 = no expiry.
}

@Injectable()
export class SolidCacheService {
    private readonly logger = new Logger(SolidCacheService.name);

    constructor(
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly configService: ConfigService,
    ) {}

    async get<T = any>(key: string): Promise<T | null> {
        try {
            const value = await this.cacheManager.get<T>(key);
            return value ?? null;
        } catch (err) {
            this.logger.warn(`Cache get failed for key "${key}": ${err.message}`);
            return null;
        }
    }

    async set(key: string, value: any, strategy: 'ttl' | 'onReboot', ttl: number): Promise<void> {
        try {
            // onReboot and ttl=-1 both mean no expiry.
            // NestJS cache-manager uses 0 to mean "no expiry".
            const ttlMs = (strategy === 'onReboot' || ttl === -1) ? 0 : ttl * 1000;
            await this.cacheManager.set(key, value, ttlMs);
        } catch (err) {
            // Cache failures must never break the main request path
            this.logger.warn(`Cache set failed for key "${key}": ${err.message}`);
        }
    }

    /**
     * Busts all cached entries for a given model.
     *
     * For Redis: uses SCAN + DEL to find and remove all keys matching solidx:{modelName}:*
     * For in-memory: no-op — in-memory store is cleared automatically on app restart.
     */
    async bustModel(modelName: string): Promise<void> {
        if (!isRedisConfigured(this.configService)) {
            // In-memory store is wiped on restart — nothing to bust
            return;
        }

        try {
            await this.scanAndDeleteRedis(`solidx:${modelName}:*`);
            this.logger.log(`Busted Redis cache for model "${modelName}"`);
        } catch (err) {
            this.logger.warn(`Cache bust failed for model "${modelName}": ${err.message}`);
        }
    }

    private async scanAndDeleteRedis(pattern: string): Promise<void> {
        // cache-manager-redis-store exposes the underlying ioredis client
        const client = (this.cacheManager.store as any).getClient();
        let cursor = '0';

        do {
            const [nextCursor, keys]: [string, string[]] = await client.scan(
                cursor,
                'MATCH',
                pattern,
                'COUNT',
                100,
            );
            cursor = nextCursor;
            if (keys.length > 0) {
                await client.del(...keys);
            }
        } while (cursor !== '0');
    }
}
