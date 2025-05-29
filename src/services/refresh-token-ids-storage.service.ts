import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { AuthenticationService } from './authentication.service';

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

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject(forwardRef(() => AuthenticationService))
        private readonly authenticationService: AuthenticationService
    ) { }

    async insert(userId: number, refreshToken: string): Promise<void> {
        // TODO: save a refresh token object with this shape {"currentRefreshToken": "", "previousRefreshToken": ""}
        // Save a refresh token object with the shape: { currentRefreshToken: string, previousRefreshToken: string }
        const existing = (await this.cacheManager.get(this.getKey(userId))) as { currentRefreshToken?: string, previousRefreshToken?: string } | undefined;
        const refreshTokenState = {
            currentRefreshToken: refreshToken,
            previousRefreshToken: "",
        };
        await this.cacheManager.set(this.getKey(userId), refreshTokenState);
    }

    async validate(userId: number, refreshToken: string): Promise<boolean> {
        // TODO: Assume you get this shape out of the cache {"currentRefreshToken": "", "previousRefreshToken": ""}
        // Then you will compare against the currentRefreshToken.
        const storedId = await this.cacheManager.get(this.getKey(userId));
        if (storedId !== refreshToken) {
            throw new InvalidatedRefreshTokenError();
        }
        return storedId === refreshToken;
    }

    async invalidate(userId: number): Promise<void> {
        await this.cacheManager.del(this.getKey(userId));
    }

    async validateAndRotate(user: any, refreshToken: string): Promise<string> {
        let valid = false;

        // TODO: Assume you get this shape out of the cache {"currentRefreshToken": "", "previousRefreshToken": ""}
        // Then you will compare against the currentRefreshToken.
        const refreshTokenState = await this.cacheManager.get(this.getKey(user.id));
        console.log("refreshTokenState", refreshTokenState);

        // Use the authentication service to generate a new refresh token, set it in the currentRefreshToken in scenario 1 and return.

        // if UI.refresh_token is matching with Cache.currentRefreshToken
        //   then invalidate (updated cache state, no need to delete anything), then generate new token and return.
        //   also set a setTimeout to run after X minutes, this will simply update the RefreshTokenCacheState to this object {"currentRefreshToken": "R2","justInvalidatedRefreshToken": ""}
        // valid=true

        //   - if UI.refresh_token is matching Cache.justInvalidatedRefreshToken        
        //       then use the Cache.currentRefreshToken, generate new access token and return.
        //       We do not modify the cache state at all.
        // valid=true

        let newRefreshToken: string | undefined;
        if (
            refreshTokenState &&
            typeof refreshTokenState === 'object' &&
            'currentRefreshToken' in refreshTokenState &&
            'previousRefreshToken' in refreshTokenState
        ) {
            if (refreshTokenState.currentRefreshToken === refreshToken) {
                // Scenario 1: Token matches currentRefreshToken
                valid = true;
                // Rotate tokens: move current to previous, set new current (simulate generation)
                newRefreshToken = await this.authenticationService.generateRefreshToken(user); // Replace with real token generation logic


                //   updated cache state
                await this.cacheManager.set(this.getKey(user.id), {
                    currentRefreshToken: newRefreshToken,
                    previousRefreshToken: refreshTokenState.currentRefreshToken,
                });

                // Optionally, set a timeout to clear previousRefreshToken after X minutes
                setTimeout(async () => {
                    const state = (await this.cacheManager.get(this.getKey(user.id))) as any;
                    if (state && state.currentRefreshToken === newRefreshToken) {
                        await this.cacheManager.set(this.getKey(user.id), {
                            currentRefreshToken: newRefreshToken,
                            previousRefreshToken: "",
                        });
                    }
                }, 1 * 60 * 1000); // 5 minutes
            } else if (refreshTokenState.previousRefreshToken === refreshToken) {
                // Scenario 2: Token matches previousRefreshToken
                valid = true;
                // Do not modify cache
                // Generate new refresh token based on currentRefreshToken
                const existingRefreshTokenState = (await this.cacheManager.get(this.getKey(user.id))) as { currentRefreshToken?: string, previousRefreshToken?: string } | undefined;
                newRefreshToken = existingRefreshTokenState?.currentRefreshToken;
            }
        }


        if (!valid) {
            throw new InvalidatedRefreshTokenError();
        }

        // TODO: return the refresh token either currentRefreshToken
        return newRefreshToken; // Fallback to the provided tokenId if no new token was generated
    }

    private getKey(userId: number): string {
        return `user-${userId}`;
    }
}
