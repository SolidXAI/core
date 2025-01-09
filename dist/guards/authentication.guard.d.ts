import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from './access-token.guard';
import { PermissionMetadataService } from '../services/permission-metadata.service';
export declare class AuthenticationGuard implements CanActivate {
    private readonly reflector;
    private readonly accessTokenGuard;
    private readonly permissionService;
    private static readonly defaultAuthType;
    private readonly authTypeGuardMap;
    constructor(reflector: Reflector, accessTokenGuard: AccessTokenGuard, permissionService: PermissionMetadataService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
