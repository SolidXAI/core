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
import { SettingService } from '../services/setting.service';
import { createHash } from "crypto";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly permissionsService: PermissionMetadataService,
    private readonly activeSessionStorage: ActiveSessionStorageService,
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
