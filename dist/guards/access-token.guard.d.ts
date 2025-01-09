import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { jwtConfig } from '../config/iam.config';
import { PermissionMetadataService } from '../services/permission-metadata.service';
export declare class AccessTokenGuard implements CanActivate {
    private readonly jwtService;
    private readonly jwtConfiguration;
    private readonly permissionsService;
    constructor(jwtService: JwtService, jwtConfiguration: ConfigType<typeof jwtConfig>, permissionsService: PermissionMetadataService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractTokenFromHeader;
}
