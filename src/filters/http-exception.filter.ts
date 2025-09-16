// src/common/filters/http-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    Logger,
    Injectable,
    HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { HttpStatusCodeMessages } from '../interceptors/logging.interceptor';
import { ErrorMapperService } from 'src/helpers/error-mapper.service';
import { ErrorCode } from 'src/interfaces';


@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    constructor(private readonly errorMapper: ErrorMapperService) {
        this.logger.debug('HttpExceptionFilter initialized');
    }

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const isHttp = exception instanceof HttpException;
        const explicitStatus = isHttp ? exception.getStatus() : undefined;

        // Canonical code + static message
        const code: ErrorCode = this.errorMapper.mapException(exception);
        const defaultStatus = this.errorMapper.getHttpStatus(code);
        const message = this.errorMapper.getMessage(code);

        const status = explicitStatus ?? defaultStatus ?? 500;

        // Logging
        this.logger.error(
            `[${status} ${HttpStatusCodeMessages[status] || 'Internal Server Error'}] ${request?.method} ${request?.url} - ${exception?.message || message} [code=${code}]`,
        );
        if (exception?.stack) {
            this.logger.error(exception.stack);
        }

        // Preserve any extra data the exception carried (optional)
        const extra =
            (isHttp && (exception.getResponse?.() as any)) ??
            exception?.response ??
            {};

        // Keep your legacy shape; add canonical code
        response.status(status).json({
            statusCode: status,
            statusCodeMessage: HttpStatusCodeMessages[status] || 'Internal Server Error',
            // message: [message],
            errorCode: code,
            error: message,
            data: extra,
        });
    }
}