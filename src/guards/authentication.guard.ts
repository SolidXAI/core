import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_TYPE_KEY } from '../decorators/auth.decorator';
import { AuthType } from '../enums/auth-type.enum';
import { AccessTokenGuard } from './access-token.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PermissionMetadataService } from '../services/permission-metadata.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private static readonly defaultAuthType = AuthType.Bearer;
  private readonly authTypeGuardMap: Record<
    AuthType,
    CanActivate | CanActivate[]> = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.None]: { canActivate: () => true },
    };

  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly permissionService: PermissionMetadataService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // If method marked as public, then we return with true, else go ahead and apply the access token guard. 
    const contextLog = context.getHandler();
    const request = context.switchToHttp().getRequest();
    request['isListedInPublicRole'] = false;

    const isPublic = this.reflector.get(IS_PUBLIC_KEY, context.getHandler());
    if (isPublic) {
      return true;
    }

    // TODO: Check if this permission viz. contextPermission is listed in the Public role. 
    const contextPermission = `${context.getClass().name}.${context.getHandler().name}`;

    const permissionExistsInRole = await this.permissionService.permissionExistsInRole('Public', contextPermission)
    if (permissionExistsInRole.length > 0) {
      request['isListedInPublicRole'] = true;
      return true
    }

    const authTypes = this.reflector.getAllAndOverride<AuthType[]>(
      AUTH_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [AuthenticationGuard.defaultAuthType];
    const guards = authTypes.map((type) => this.authTypeGuardMap[type]).flat();
    let error = new UnauthorizedException();

    for (const instance of guards) {
      const canActivate = await Promise.resolve(
        instance.canActivate(context),
      ).catch((err) => {
        error = err;
      });

      if (canActivate) {
        return true;
      }
    }
    throw error;
  }
}
