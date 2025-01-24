import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Logger } from 'winston';
import { Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { WINSTON_MODULE_NEST_PROVIDER, WINSTON_MODULE_PROVIDER } from 'nest-winston';

export const HttpStatusCodeMessages = {
    100: "Continue",
    101: "Switching Protocols",
    102: "Processing",
    200: "OK",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    207: "Multi-Status",
    208: "Already Reported",
    226: "IM Used",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    305: "Use Proxy",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    416: "Range Not Satisfiable",
    417: "Expectation Failed",
    418: "I'm a teapot",  // Uncommon, but part of the April Fools' joke (RFC 2324)
    421: "Misdirected Request",
    422: "Unprocessable Entity",
    423: "Locked",
    424: "Failed Dependency",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    510: "Not Extended",
    511: "Network Authentication Required",
};


@Injectable()
export class LoggingInterceptor implements NestInterceptor {

    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const { method, url } = req;
        const startTime = Date.now();

        // We will capture any error that occurs in the request lifecycle.
        return next.handle().pipe(
            tap(() => {
                // If the request was successful, log the status code and time
                const responseTime = Date.now() - startTime;
                this.logger.info(
                    `[${res.statusCode} ${HttpStatusCodeMessages[res.statusCode] || ''}] ${method} ${url} ${responseTime}ms`,
                );
            }),
            catchError((err) => {
                const status = err.status || res.statusCode || 500;
                // If an error occurs, it is likely due to a guard rejecting the request
                const responseTime = Date.now() - startTime;
                this.logger.error(
                    `[${status || 500} ${HttpStatusCodeMessages[status] || 'Internal Server Error'}] ${method} ${url} - ${err.message || 'Unknown error'} ${responseTime}ms`,
                );
                // Re-throw the error after logging it
                throw err;
            }),
        );
    }
}