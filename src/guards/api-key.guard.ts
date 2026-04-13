import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { REQUEST_USER_KEY } from 'src/constants';
import { ApiKeyService } from 'src/services/api-key.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly apiKeyService: ApiKeyService,
        private readonly cls: ClsService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const rawKey = this.extractKeyFromHeader(request);

        if (!rawKey) {
            throw new UnauthorizedException();
        }

        const activeUser = await this.apiKeyService.validate(rawKey);
        request[REQUEST_USER_KEY] = activeUser;
        this.cls.set(REQUEST_USER_KEY, activeUser);

        return true;
    }

    private extractKeyFromHeader(request: Request): string | undefined {
        return request.headers['solidx-api-key'] as string | undefined;
    }
}
