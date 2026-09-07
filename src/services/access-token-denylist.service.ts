import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";
import { SettingService } from "./setting.service";

// The denylist entry must outlive the longest-lived access token it could
// match. Any token an entry rejects was issued before the revocation, so it
// dies by revokedAt + accessTokenTtl at the latest; after that `exp` rejects it
// and the entry is dead weight. Mirrors STATE_TTL_BUFFER_SECONDS in
// refresh-token-ids-storage.service.ts.
const ENTRY_TTL_BUFFER_SECONDS = 60;

/**
 * Immediate access-token revocation, opt-in via `invalidateAccessTokenOnLogout`.
 *
 * Entries record WHEN a session was revoked rather than merely that it was, and
 * the guard compares that instant against the token's own `iat`. The timestamp
 * is what makes a session-scoped key safe: some keys are reused across logins -
 * API-key auth passes a stable `apikey-<id>` deviceKey, and the per-user key
 * below is shared by every login that user will ever make - so a boolean entry
 * would have to either reject the newly minted token too, or be cleared on
 * re-issue and thereby revive the still-unexpired token the logout killed.
 * Comparing against `iat` needs neither: tokens minted after the revocation
 * pass, tokens minted before it fail, and nothing is ever cleared.
 *
 * This service owns the setting check - callers never branch on it. One source
 * of truth instead of three call sites that can drift, no `if (enabled)` nesting
 * in logout(), and a consuming project using the public seam cannot write
 * entries that nothing will ever read. `getConfigValue` is a synchronous
 * in-memory lookup, so a deployment that has not opted in pays nothing and
 * issues no I/O.
 */
@Injectable()
export class AccessTokenDenylistService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly settingService: SettingService,
  ) {}

  isEnabled(): boolean {
    return (
      this.settingService.getConfigValue<SolidCoreSetting>(
        "invalidateAccessTokenOnLogout",
      ) === true
    );
  }

  /**
   * Revoke every access token belonging to one session. A no-op when the
   * feature is off, and when no session key could be resolved - which spares
   * the caller a null check.
   */
  async revokeSession(userId: number, sessionKey?: string): Promise<void> {
    if (!this.isEnabled() || !sessionKey) {
      return;
    }
    await this.cacheManager.set(
      this.getSessionKey(userId, sessionKey),
      this.revokedAt(),
      this.getEntryTtlMs(),
    );
  }

  /**
   * Revoke every access token for a user, across all sessions - `allDevices`.
   *
   * Needs no claim on the token and no enumeration of buckets: every
   * outstanding token was necessarily issued before the logout that writes
   * this, so one entry sweeps them all.
   */
  async revokeAllForUser(userId: number): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    await this.cacheManager.set(
      this.getUserKey(userId),
      this.revokedAt(),
      this.getEntryTtlMs(),
    );
  }

  /**
   * True when the token was issued before either revocation instant that could
   * apply to it - its own session's, or its user's.
   *
   * Returns false without touching the cache when the feature is off, which is
   * why the guard needs no setting check of its own.
   */
  async isRevoked(
    userId: number,
    sessionKey: string,
    issuedAtSeconds?: number,
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // A token with no `iat` cannot be placed relative to a revocation. Tokens
    // signed by @nestjs/jwt always carry one, so this is a malformed-payload
    // guard rather than a real case; refuse rather than fail open.
    if (typeof issuedAtSeconds !== "number") {
      return true;
    }

    const [sessionRevokedAt, userRevokedAt] = await Promise.all([
      this.cacheManager.get<number>(this.getSessionKey(userId, sessionKey)),
      this.cacheManager.get<number>(this.getUserKey(userId)),
    ]);

    const revokedAt = Math.max(sessionRevokedAt ?? 0, userRevokedAt ?? 0);
    return issuedAtSeconds * 1000 < revokedAt;
  }

  /**
   * `iat` has whole-second resolution, so a token minted in the same second as
   * the revocation is indistinguishable from one minted just before it.
   * Rounding up resolves that ambiguity toward revoking: an automated client
   * re-authenticating inside the window gets one 401 and succeeds on retry,
   * whereas rounding down would leave a genuinely revoked token valid for up to
   * a second. No human path can reach the window at all - logout invalidates
   * the refresh token, so the next access token only exists after a fresh login.
   */
  private revokedAt(): number {
    return (Math.floor(Date.now() / 1000) + 1) * 1000;
  }

  private getSessionKey(userId: number, sessionKey: string): string {
    return `revoked-session-${userId}-${sessionKey}`;
  }

  private getUserKey(userId: number): string {
    return `revoked-user-${userId}`;
  }

  // cache-manager v5 expects milliseconds; accessTokenTtl is configured in
  // seconds. Read from the setting rather than hardcoded so that raising
  // accessTokenTtl keeps entries long enough to outlive the tokens they match.
  private getEntryTtlMs(): number {
    const accessTokenTtlSeconds = Number(
      this.settingService.getConfigValue<SolidCoreSetting>("accessTokenTtl"),
    );
    return (accessTokenTtlSeconds + ENTRY_TTL_BUFFER_SECONDS) * 1000;
  }
}
