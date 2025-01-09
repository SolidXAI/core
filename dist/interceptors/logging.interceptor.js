"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingInterceptor = exports.HttpStatusCodeMessages = void 0;
const common_1 = require("@nestjs/common");
const winston_1 = require("winston");
const common_2 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const nest_winston_1 = require("nest-winston");
exports.HttpStatusCodeMessages = {
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
    418: "I'm a teapot",
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
let LoggingInterceptor = class LoggingInterceptor {
    constructor(logger) {
        this.logger = logger;
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const { method, url } = req;
        const startTime = Date.now();
        return next.handle().pipe((0, operators_1.tap)(() => {
            const responseTime = Date.now() - startTime;
            this.logger.info(`[${res.statusCode} ${exports.HttpStatusCodeMessages[res.statusCode] || ''}] ${method} ${url} ${responseTime}ms`);
        }), (0, operators_1.catchError)((err) => {
            const status = err.status || res.statusCode || 500;
            const responseTime = Date.now() - startTime;
            this.logger.error(`[${status || 500} ${exports.HttpStatusCodeMessages[status] || 'Internal Server Error'}] ${method} ${url} - ${err.message || 'Unknown error'} ${responseTime}ms`);
            throw err;
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_2.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [winston_1.Logger])
], LoggingInterceptor);
//# sourceMappingURL=logging.interceptor.js.map