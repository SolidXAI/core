import { Cache } from 'cache-manager';
export declare class InvalidatedRefreshTokenError extends Error {
}
export declare class RefreshTokenIdsStorageService {
    private cacheManager;
    constructor(cacheManager: Cache);
    insert(userId: number, tokenId: string): Promise<void>;
    validate(userId: number, tokenId: string): Promise<boolean>;
    invalidate(userId: number): Promise<void>;
    private getKey;
}
