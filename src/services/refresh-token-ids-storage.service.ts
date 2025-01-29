import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

// TODO: Ideally this should be in a separate file - putting this here for brevity
export class InvalidatedRefreshTokenError extends Error { }

@Injectable()
// export class RefreshTokenIdsStorageService implements OnApplicationBootstrap, OnApplicationShutdown {
export class RefreshTokenIdsStorageService {
    // private redisClient: Redis;
    // onApplicationBootstrap() {
    //     // TODO: Ideally, we should move this to the dedicated "RedisModule" instead of initiating the connection here.
    //     this.redisClient = new Redis({
    //         // TODO: According to best practices, we should use the environment variables here instead.
    //         host: 'localhost',
    //         port: 6379,
    //     });
    // }
    // onApplicationShutdown(signal?: string) {
    //     return this.redisClient.quit();
    // }

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async insert(userId: number, tokenId: string): Promise<void> {
        await this.cacheManager.set(this.getKey(userId), tokenId);
    }

    async validate(userId: number, tokenId: string): Promise<boolean> {
        const storedId = await this.cacheManager.get(this.getKey(userId));
        if (storedId !== tokenId) {
            throw new InvalidatedRefreshTokenError();
        }
        return storedId === tokenId;
    }

    async invalidate(userId: number): Promise<void> {
        await this.cacheManager.del(this.getKey(userId));
    }

    private getKey(userId: number): string {
        return `user-${userId}`;
    }
}
