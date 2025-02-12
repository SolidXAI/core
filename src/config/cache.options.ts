import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { isNumber } from 'class-validator';

export const RedisOptions: CacheModuleAsyncOptions = {
    isGlobal: true,
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => {
        if (!isRedisConfigured(configService)) {
            return {} // This defaults to in-memory cache
        }
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

function isRedisConfigured(configService: ConfigService): boolean {
    const host = configService.get<string>('REDIS_HOST');
    const port = configService.get<string>('REDIS_PORT');
    return host && port && isNumber(parseInt(port));
}