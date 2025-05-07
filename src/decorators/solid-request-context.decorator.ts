import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { REQUEST_USER_KEY } from '../constants';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';

export const SolidRequestContextDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SolidRequestContextDto => {
    const request = ctx.switchToHttp().getRequest();
    // TODO idealiy we should use RequestContextService and getActiveUser method. (Works for async scenarios too)
    const activeUser: ActiveUserData | undefined = request[REQUEST_USER_KEY];

    // Create a new instance of SolidRequestContextDto and stamp user data
    const solidRequestContext = new SolidRequestContextDto();
    solidRequestContext.activeUser = activeUser;

    return solidRequestContext; // Return modified request context DTO
  },
);
