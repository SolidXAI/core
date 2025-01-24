/** NOT USED */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';

import { REQUEST_USER_KEY } from "../constants";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Get hold of roles required, as configured at the handler or class level.
    const contextRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If nothing configured then we assume that all roles are allowed access, hence return true. 
    if (!contextRoles) {
      return true;
    }

    // Else get hold of the active user & compare what roles they have and basis that return.
    const user: ActiveUserData = context.switchToHttp().getRequest()[
      REQUEST_USER_KEY
    ];

    const usersRoles = user ? user.roles : [];

    return contextRoles.some((role) => usersRoles.includes(role));
  }
}
