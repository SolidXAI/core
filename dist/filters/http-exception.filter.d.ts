import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
export declare class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: any, host: ArgumentsHost): void;
}
