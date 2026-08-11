import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
// cache-manager-redis-yet, not cache-manager-redis-store. The latter stops at
// 3.0.1 and implements the cache-manager v4 store contract: it expects an
// options object and reads `options.ttl` in seconds. cache-manager v5 calls
// `store.set(key, value, ttl)` with a bare number of milliseconds, so that
// store found no `.ttl`, fell back to an unset default, and issued a plain
// `SET` - silently discarding every TTL passed anywhere in the app and leaving
// Redis keys that never expire. redis-yet implements the v5 contract and
// writes with `PX`, so millisecond TTLs land correctly.
import { redisStore } from 'cache-manager-redis-yet';
import { isRedisConfigured } from 'src/helpers/environment.helper';

export const CacheManagerOptions: CacheModuleAsyncOptions = {
    isGlobal: true,
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => {

        // This defaults to in-memory cache
        if (!isRedisConfigured(configService)) {
            return {
                ttl: 0
            }
        }

        // If redis is configured we use that...
        const store = await createRedisStore(configService);
        return {
            store: () => store,
        };
    },
    inject: [ConfigService],
};

async function createRedisStore(configService: ConfigService<Record<string, unknown>, false>) {
    return await redisStore({
        socket: {
            host: configService.get<string>('REDIS_HOST'),
            port: parseInt(configService.get<string>('REDIS_PORT')!),
        },
    });
}
