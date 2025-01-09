import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Response } from 'express';
import { HttpStatusCodeMessages } from '../interceptors/logging.interceptor';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

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
        if (exception.response) {
            response.status(status).json({
                ...exception.response,
                error: message,
                data: {}
            });
        }
        else {
            response.status(status).json({
                statusCode: status,
                message: [message],
                error: message,
                data: {}
            });
        }
    }
}