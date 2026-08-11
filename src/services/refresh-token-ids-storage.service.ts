import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomUUID } from 'crypto';
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

/**
 * The bucket-identifying claims carried on a refresh token. Absent on tokens
 * issued before per-device sessions existed, and on tokens issued while
 * preventConcurrentLogins is on - which is exactly how the read path tells the
 * two schemes apart without consulting any setting.
 */
export type RefreshTokenClaims = {
    deviceKey?: string;
    epoch?: number;
};

export type RotatedRefreshToken = {
    refreshToken: string;
    // The bucket the rotated token now lives in. Differs from the incoming
    // deviceKey only when a pre-migration token was just moved into one.
    deviceKey?: string;
};

@Injectable()
export class RefreshTokenIdsStorageService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject(forwardRef(() => AuthenticationService))
        private readonly authenticationService: AuthenticationService,
        private readonly settingService: SettingService,
    ) { }

    /**
     * The inverse of the `preventConcurrentLogins` setting, and the only place
     * it is interpreted.
     *
     * That setting already promises, when off, that sessions may coexist;
     * splitting the refresh-token keyspace per device is what finally delivers
     * it. When it is on, its stated purpose is a single live session, so
     * per-device keys would be meaningless and the original single slot is kept.
     *
     * This governs the WRITE path only. Reads always branch on the token's own
     * claim, so toggling the setting never invalidates a live session.
     */
    areConcurrentLoginsAllowed(): boolean {
        return !this.settingService.getConfigValue<SolidCoreSetting>("preventConcurrentLogins");
    }

    async insert(
        userId: number,
        refreshToken: string,
        previousRefreshToken?: string,
        deviceKey?: string,
    ): Promise<void> {
        const refreshTokenState: RefreshTokenState = {
            currentRefreshToken: refreshToken,
            previousRefreshToken: previousRefreshToken ?? "",
            ...(previousRefreshToken
                ? { previousValidUntil: Date.now() + PREVIOUS_TOKEN_GRACE_MS }
                : {}),
        };
        await this.cacheManager.set(
            this.getKey(userId, deviceKey),
            refreshTokenState,
            this.getStateTtlMs(),
        );
    }

    async invalidate(userId: number, deviceKey?: string): Promise<void> {
        await this.cacheManager.del(this.getKey(userId, deviceKey));
    }

    /**
     * Bulk invalidation - "log out everywhere", and the right hook for password
     * change or forced deactivation.
     *
     * Per-device buckets cannot be enumerated through cache-manager, so this
     * bumps a per-user epoch that every per-device token carries as a claim.
     * One write invalidates every outstanding token without a scan and without
     * the read-modify-write race an index of device keys would have.
     */
    async invalidateAll(userId: number): Promise<void> {
        const currentEpoch = (await this.getEpoch(userId)) ?? 0;
        await this.cacheManager.set(
            this.getEpochKey(userId),
            currentEpoch + 1,
            // Outlives every bucket that could hold a pre-bump token: those were
            // written earlier, so they expire no later than this key does.
            this.getStateTtlMs(),
        );
        // Single-slot mode and pre-migration entries live under the bare key,
        // which carries no epoch claim - delete it directly.
        await this.cacheManager.del(this.getKey(userId));
    }

    async getEpoch(userId: number): Promise<number | undefined> {
        return (await this.cacheManager.get<number>(this.getEpochKey(userId))) ?? undefined;
    }

    async validateAndRotate(
        user: any,
        refreshToken: string,
        claims: RefreshTokenClaims = {},
    ): Promise<RotatedRefreshToken> {
        const { deviceKey, epoch } = claims;

        // The read key comes from the token's own claim, never from a setting.
        // A token issued under either scheme therefore stays valid when
        // preventConcurrentLogins is toggled - in both directions - and a
        // pre-migration token still finds the bare key it was written to.
        const refreshTokenState = await this.cacheManager.get(
            this.getKey(user.id, deviceKey),
        ) as RefreshTokenState | undefined;

        if (!this.isRefreshTokenState(refreshTokenState)) {
            throw new InvalidatedRefreshTokenError();
        }

        if (deviceKey && !(await this.isEpochCurrent(user.id, epoch))) {
            throw new InvalidatedRefreshTokenError();
        }

        // Scenario 1: the live token. Rotate it. generateRefreshToken calls
        // insert(), which writes the new state and stamps the grace deadline
        // onto the token being rotated out.
        if (refreshTokenState.currentRefreshToken === refreshToken) {
            const nextDeviceKey = this.resolveNextDeviceKey(deviceKey);
            const rotated = await this.authenticationService.generateRefreshToken(
                user,
                refreshToken,
                nextDeviceKey,
            );

            if (nextDeviceKey !== deviceKey) {
                // The session changed buckets - either migrating out of the
                // pre-deploy single slot, or collapsing back into it because
                // preventConcurrentLogins was switched on. The new state is
                // already written; drop the key it came from so nothing is
                // left behind.
                await this.cacheManager.del(this.getKey(user.id, deviceKey));
            }

            return { refreshToken: rotated, deviceKey: nextDeviceKey };
        }

        // Scenario 2: the token just rotated out. This is the concurrent-request
        // case the previous slot exists for - a second in-flight request that
        // was issued the old token before the first one rotated it. Hand back
        // the live token so it succeeds, provided the grace window is still open.
        if (refreshTokenState.previousRefreshToken && refreshTokenState.previousRefreshToken === refreshToken) {
            if (!this.isWithinGraceWindow(refreshTokenState)) {
                throw new InvalidatedRefreshTokenError();
            }
            return { refreshToken: refreshTokenState.currentRefreshToken, deviceKey };
        }

        throw new InvalidatedRefreshTokenError();
    }

    getCurrentRefreshTokenState(
        userId: number,
        deviceKey?: string,
    ): Promise<RefreshTokenState | undefined> {
        return this.cacheManager.get(this.getKey(userId, deviceKey));
    }

    private getKey(userId: number, deviceKey?: string): string {
        return deviceKey ? `user-${userId}-${deviceKey}` : `user-${userId}`;
    }

    // Deliberately not `user-${userId}-epoch`, which a device key of the
    // literal string "epoch" would collide with.
    private getEpochKey(userId: number): string {
        return `user-epoch-${userId}`;
    }

    /**
     * Which bucket a rotated token should land in. The setting is consulted
     * first so that turning preventConcurrentLogins ON collapses existing
     * per-device sessions back into the single slot on their next refresh -
     * where normal last-login-wins applies, which is what that setting means.
     * Leaving them in their own buckets would keep concurrent sessions alive
     * while the setting claimed to forbid them.
     */
    private resolveNextDeviceKey(deviceKey?: string): string | undefined {
        if (!this.areConcurrentLoginsAllowed()) {
            return undefined;
        }
        return deviceKey ?? randomUUID();
    }

    private async isEpochCurrent(userId: number, epoch?: number): Promise<boolean> {
        const storedEpoch = await this.getEpoch(userId);
        // Nothing has ever been bulk-invalidated for this user - or the cache
        // was flushed, in which case every bucket is gone and the token is
        // already dead by the read above. Either way, accept.
        if (storedEpoch === undefined) {
            return true;
        }
        return epoch === storedEpoch;
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
