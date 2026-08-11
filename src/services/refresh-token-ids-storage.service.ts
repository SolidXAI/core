import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Cache } from 'cache-manager';
import type { SolidCoreSetting } from 'src/services/settings/default-settings-provider.service';
import { AuthenticationService } from './authentication.service';
import { SettingService } from './setting.service';

// TODO: Ideally this should be in a separate file - putting this here for brevity
export class InvalidatedRefreshTokenError extends Error { }

// How long a rotated-out refresh token stays acceptable. This window is the
// point of keeping a previous token at all: concurrent requests from one user
// must not break each other. core-ui's single-flight guard is module-level and
// therefore per tab, so two tabs crossing the refresh threshold together will
// both present the same token - the second one is served from here.
const PREVIOUS_TOKEN_GRACE_MS = 60 * 1000;

// The cache entry must outlive the JWT it holds. If it expired first, refresh
// would fail with ACCESS_DENIED (InvalidatedRefreshTokenError) rather than the
// SESSION_EXPIRED that the token's own `exp` produces - the same event
// reported two different ways.
const STATE_TTL_BUFFER_SECONDS = 60;

type RefreshTokenState = {
    currentRefreshToken: string;
    previousRefreshToken: string;
    // Absolute epoch-ms deadline after which previousRefreshToken is refused.
    // Stored rather than scheduled: an in-process timer is lost when the pod
    // restarts, which used to leave the rotated-out token valid until the next
    // rotation instead of for one minute. Optional because entries written
    // before this field existed will not carry it.
    previousValidUntil?: number;
};

@Injectable()
export class RefreshTokenIdsStorageService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject(forwardRef(() => AuthenticationService))
        private readonly authenticationService: AuthenticationService,
        private readonly settingService: SettingService,
    ) { }

    async insert(userId: number, refreshToken: string, previousRefreshToken?: string): Promise<void> {
        const refreshTokenState: RefreshTokenState = {
            currentRefreshToken: refreshToken,
            previousRefreshToken: previousRefreshToken ?? "",
            ...(previousRefreshToken
                ? { previousValidUntil: Date.now() + PREVIOUS_TOKEN_GRACE_MS }
                : {}),
        };
        await this.cacheManager.set(this.getKey(userId), refreshTokenState, this.getStateTtlMs());
    }

    async invalidate(userId: number): Promise<void> {
        await this.cacheManager.del(this.getKey(userId));
    }

    async validateAndRotate(user: any, refreshToken: string): Promise<string> {
        const refreshTokenState = await this.cacheManager.get(this.getKey(user.id)) as RefreshTokenState | undefined;

        if (!this.isRefreshTokenState(refreshTokenState)) {
            throw new InvalidatedRefreshTokenError();
        }

        // Scenario 1: the live token. Rotate it. generateRefreshToken calls
        // insert(), which writes the new state and stamps the grace deadline
        // onto the token being rotated out.
        if (refreshTokenState.currentRefreshToken === refreshToken) {
            return await this.authenticationService.generateRefreshToken(user, refreshToken);
        }

        // Scenario 2: the token just rotated out. This is the concurrent-request
        // case the previous slot exists for - a second in-flight request that
        // was issued the old token before the first one rotated it. Hand back
        // the live token so it succeeds, provided the grace window is still open.
        if (refreshTokenState.previousRefreshToken && refreshTokenState.previousRefreshToken === refreshToken) {
            if (!this.isWithinGraceWindow(refreshTokenState)) {
                throw new InvalidatedRefreshTokenError();
            }
            return refreshTokenState.currentRefreshToken;
        }

        throw new InvalidatedRefreshTokenError();
    }

    getCurrentRefreshTokenState(userId: number): Promise<RefreshTokenState | undefined> {
        return this.cacheManager.get(this.getKey(userId));
    }

    private getKey(userId: number): string {
        return `user-${userId}`;
    }

    // cache-manager v5 expects milliseconds; refreshTokenTtl is configured in
    // seconds. Without an explicit TTL these entries never expire - neither
    // cache path supplies a default - and the keyspace grows without bound.
    private getStateTtlMs(): number {
        const refreshTokenTtlSeconds = Number(
            this.settingService.getConfigValue<SolidCoreSetting>("refreshTokenTtl"),
        );
        return (refreshTokenTtlSeconds + STATE_TTL_BUFFER_SECONDS) * 1000;
    }

    private isRefreshTokenState(state: unknown): state is RefreshTokenState {
        return (
            !!state &&
            typeof state === 'object' &&
            'currentRefreshToken' in state &&
            'previousRefreshToken' in state
        );
    }

    private isWithinGraceWindow(state: RefreshTokenState): boolean {
        // TRANSITIONAL - safe to delete one refreshTokenTtl after this ships.
        //
        // Entries written before previousValidUntil existed carry no deadline
        // to test. They are accepted so that the deploy rejects nobody: a tab
        // that legitimately rotated moments earlier keeps working. The cost is
        // that for such an entry the previous token stays acceptable until its
        // own JWT `exp` rather than for 60s - which is exactly how the old code
        // already behaved whenever its in-process timer was lost to a restart,
        // so this is an unfixed pre-existing case, not a new one.
        //
        // It self-heals: the user's next rotation writes a new-format state
        // with a deadline. Once every pre-deploy entry has rotated or expired
        // (one refreshTokenTtl), this branch is unreachable - drop it, and the
        // undefined case becomes a rejection.
        if (state.previousValidUntil === undefined) {
            return true;
        }
        return Date.now() < state.previousValidUntil;
    }
}
