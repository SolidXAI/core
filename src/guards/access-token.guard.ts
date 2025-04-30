import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { jwtConfig } from '../config/iam.config';
import { REQUEST_USER_KEY } from "../constants";
import { PermissionMetadataService } from '../services/permission-metadata.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly permissionsService: PermissionMetadataService,
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
      const payload: ActiveUserData = await this.jwtService.verifyAsync(
        token,
        this.jwtConfiguration,
      );

      // Load permissions given the user. 
      const permissions = await this.permissionsService.findAllUsingRoles(payload.roles);
      payload.permissions = permissions.map((permission) => permission.name);

      request[REQUEST_USER_KEY] = payload;
      this.cls.set(REQUEST_USER_KEY, payload);
      // console.log(`About to set payload in the request user key:`);
      // console.log(payload);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // Since token is included in the Authorization header something like 
    // Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlcjFAbmVzdGpzLmNvbSIsImlhdCI6MTcwMDk5NTk1MywiZXhwIjoxNzAwOTk5NTUzLCJhdWQiOiJsb2NhbGhvc3Q6MzAwMCIsImlzcyI6ImxvY2FsaG9zdDozMDAwIn0.303Y04SZjKqoPjJRq4hXHcarHeZYS878gPGWmw2SoUc
    const [_, token] = request.headers.authorization?.split(' ') ?? [];
    return token;
  }
}
