import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUEST_USER_KEY } from "../constants";

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) { }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.get(IS_PUBLIC_KEY, context.getHandler());
        if (isPublic) {
            return true;
        }

        // Permission is defined as ControllerName.methodName
        const contextPermission = `${context.getClass().name}.${context.getHandler().name}`;

        // Check if this permission viz. contextPermission is listed in the Public role. 
        const request = context.switchToHttp().getRequest();
        if (request.isListedInPublicRole === true) {
            return true
        }

        // Else get hold of the active user & compare what roles they have and basis that return.
        const user: ActiveUserData = context.switchToHttp().getRequest()[
            REQUEST_USER_KEY
        ];

        const userPermissions = user ? user.permissions : [];

        // If the userPermission set includes the context permission, it means they are allowed to access the specified method.
        return userPermissions.includes(contextPermission);
    }
}
