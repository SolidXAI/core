import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { MediaDownloadUrlService } from 'src/services/media-download-url.service';

@Injectable()
export class MediaSignedUrlGuard implements CanActivate {
  constructor(private readonly mediaDownloadUrlService: MediaDownloadUrlService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromQuery(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: { mediaId: number };
    try {
      payload = await this.mediaDownloadUrlService.verifyDownloadToken(token);
    } catch {
      throw new UnauthorizedException();
    }

    const routeMediaId = Number(request.params?.id);
    if (!Number.isFinite(routeMediaId) || payload.mediaId !== routeMediaId) {
      throw new UnauthorizedException();
    }

    // No REQUEST_USER_KEY is ever set for token auth (only Bearer/ApiKey guards set it), so
    // the sibling global APP_GUARD PermissionsGuard would otherwise reject this request for
    // lack of a per-user permission grant. Flag it the same way AuthenticationGuard flags
    // Public-role-exempt requests - token possession IS the full authorization decision here.
    request['isListedInPublicRole'] = true;

    return true;
  }

  private extractTokenFromQuery(request: Request): string | undefined {
    const token = request.query?.token;
    return typeof token === 'string' ? token : undefined;
  }
}
