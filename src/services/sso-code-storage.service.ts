import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';

const SSO_CODE_TTL_MS = 60 * 1000; // 60 seconds

interface SsoCodeEntry {
    userId: number;
    accessToken: string;
    refreshToken: string;
}

@Injectable()
export class SsoCodeStorageService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async generateCode(userId: number, accessToken: string, refreshToken: string): Promise<string> {
        const code = randomBytes(32).toString('hex');
        await this.cacheManager.set(this.getKey(code), { userId, accessToken, refreshToken }, SSO_CODE_TTL_MS);
        return code;
    }

    async consumeCode(code: string): Promise<SsoCodeEntry> {
        const entry = await this.cacheManager.get<SsoCodeEntry>(this.getKey(code));
        if (!entry) {
            throw new UnauthorizedException('Invalid or expired SSO code');
        }
        await this.cacheManager.del(this.getKey(code));
        return entry;
    }

    private getKey(code: string): string {
        return `sso-code-${code}`;
    }
}
