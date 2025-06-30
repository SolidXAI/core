import { ExceptionFilter, Catch, ArgumentsHost, Logger, Injectable } from '@nestjs/common';
import { Response } from 'express';
import { HttpStatusCodeMessages } from '../interceptors/logging.interceptor';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    constructor() {
        this.logger.debug('HttpExceptionFilter initialized');
    } 

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest();
        const status = exception.status || 500;
        const message = exception.message || 'Internal server error';
        const { method, url } = request;

        // Log the error here
        this.logger.error(`[${status || 500} ${HttpStatusCodeMessages[status] || 'Internal Server Error'}] ${method} ${url} - ${message}`);
        this.logger.error(exception.stack || 'No stack trace available');

        // Send the response to the client
        const errorJson = this.getErrorJson(status, message, exception.response);
        response.status(status).json(errorJson);
    }

    private getErrorJson(status: number|string, message: string, additionalErrorData: unknown = {}): any {
        return {
            statusCode: status,
            message: [message],
            error: HttpStatusCodeMessages[status] || 'Internal Server Error',
            data: additionalErrorData
        }
    }
}