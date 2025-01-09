"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisOptions = void 0;
const config_1 = require("@nestjs/config");
const cache_manager_redis_store_1 = require("cache-manager-redis-store");
exports.RedisOptions = {
    isGlobal: true,
    imports: [config_1.ConfigModule],
    useFactory: async (configService) => {
        const store = await (0, cache_manager_redis_store_1.redisStore)({
            socket: {
                host: configService.get('REDIS_HOST'),
                port: parseInt(configService.get('REDIS_PORT')),
            },
        });
        return {
            store: () => store,
        };
    },
    inject: [config_1.ConfigService],
};
//# sourceMappingURL=redis.options.js.map