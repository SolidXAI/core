import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
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
