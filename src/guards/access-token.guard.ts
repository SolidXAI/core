import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { REQUEST_USER_KEY } from "../constants";
import { PermissionMetadataService } from '../services/permission-metadata.service';
import { ClsService } from 'nestjs-cls';
import { ActiveSessionStorageService } from "../services/active-session-storage.service";
import { AccessTokenDenylistService } from "../services/access-token-denylist.service";
import { SettingService } from '../services/setting.service';
import { createHash } from "crypto";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly permissionsService: PermissionMetadataService,
    private readonly activeSessionStorage: ActiveSessionStorageService,
    private readonly accessTokenDenylist: AccessTokenDenylistService,
    private readonly settingService: SettingService,
    private readonly cls: ClsService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 💡 NOTE: For GraphQL applications, you'd have to use the wrapper GqlExecutionContext here instead.
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {

      const jwtConfiguration = {
        secret: this.settingService.getConfigValue<SolidCoreSetting>("secret"),
        audience: this.settingService.getConfigValue<SolidCoreSetting>("audience"),
        issuer: this.settingService.getConfigValue<SolidCoreSetting>("issuer"),
        accessTokenTtl: this.settingService.getConfigValue<SolidCoreSetting>("accessTokenTtl"),
        refreshTokenTtl: this.settingService.getConfigValue<SolidCoreSetting>("refreshTokenTtl")
      }
      const payload: ActiveUserData = await this.jwtService.verifyAsync(
        token,
        jwtConfiguration
      );

      // Immediate access-token revocation. Runs BEFORE the concurrent-login
      // check on purpose: rejecting a revoked token first stops it reaching the
      // adopt-on-empty branch below and reclaiming the active session slot.
      // No setting check here - isRevoked short-circuits when the feature is
      // off, without touching the cache.
      await this.validateNotRevoked(payload, token);

      // Prevent Concurrent Login Feature
      await this.validateConcurrentLoginSession(payload, token);

      // Load permissions given the user. 
      const permissions = await this.permissionsService.findAllUsingRoles(payload.roles);
      payload.permissions = permissions.map((permission) => permission.name);

      request[REQUEST_USER_KEY] = payload;
      this.cls.set(REQUEST_USER_KEY, payload);
      // console.log(`About to set payload in the request user key:`);
      // console.log(payload);
    } catch (err) {
      throw err instanceof UnauthorizedException
        ? err
        : new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // Since token is included in the Authorization header something like 
    // Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlcjFAbmVzdGpzLmNvbSIsImlhdCI6MTcwMDk5NTk1MywiZXhwIjoxNzAwOTk5NTUzLCJhdWQiOiJsb2NhbGhvc3Q6MzAwMCIsImlzcyI6ImxvY2FsaG9zdDozMDAwIn0.303Y04SZjKqoPjJRq4hXHcarHeZYS878gPGWmw2SoUc
    const [_, token] = request.headers.authorization?.split(' ') ?? [];
    return token;
  }

  private resolveSessionId(payload: ActiveUserData, token: string): string {
    if (payload.sessionId) {
      return payload.sessionId;
    }

    // Legacy tokens (issued before preventConcurrentLogins was enabled)
    // have no sessionId claim, so derive a stable fallback from the token.
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * The key this token's session is denylisted under.
   *
   * Deliberately NOT merged with resolveSessionId above, which differs only by
   * the deviceKey step. Merging them would change validateConcurrentLoginSession
   * for tokens issued while preventConcurrentLogins was off that are still live
   * when it is switched on: those resolve to sha256(token) today and would
   * resolve to deviceKey instead. The divergence is invisible in normal
   * operation - that check only runs while the setting is on, and tokens issued
   * in that state never carry a deviceKey - so the two formulas already agree
   * for every token it sees. Only toggle-crossover tokens tell them apart.
   */
  private resolveRevocationKey(payload: ActiveUserData, token: string): string {
    return (
      payload.sessionId ??
      payload.deviceKey ??
      createHash('sha256').update(token).digest('hex')
    );
  }

  private async validateNotRevoked(payload: ActiveUserData, token: string): Promise<void> {
    // isRevoked would short-circuit on its own, but resolving the key first can
    // cost a sha256 for a token carrying neither claim. Checking here keeps the
    // opted-out path genuinely free.
    if (!this.accessTokenDenylist.isEnabled()) {
      return;
    }

    const revocationKey = this.resolveRevocationKey(payload, token);
    const revoked = await this.accessTokenDenylist.isRevoked(
      payload.sub,
      revocationKey,
      payload.iat,
    );
    if (revoked) {
      throw new UnauthorizedException(ERROR_MESSAGES.SESSION_INVALID);
    }
  }

  private async validateConcurrentLoginSession(payload: ActiveUserData, token: string,): Promise<void> {
    if (!this.settingService.getConfigValue<SolidCoreSetting>("preventConcurrentLogins",)) {
      return;
    }

    const activeSessionId = await this.activeSessionStorage.getActiveSession(payload.sub);
    const currentSessionId = this.resolveSessionId(payload, token);

    if (!activeSessionId) {
      // No active session recorded yet for this user — this is the first
      // request we've seen since the feature was enabled (or storage was
      // cleared). Adopt this request's session as the active one so this
      // browser stays logged in going forward.
      await this.activeSessionStorage.setActiveSession(payload.sub, currentSessionId,);
      return;
    }

    if (currentSessionId !== activeSessionId) {
      throw new UnauthorizedException(ERROR_MESSAGES.SESSION_INVALID);
    }
  }
}
