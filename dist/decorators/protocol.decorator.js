"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Protocol = void 0;
const common_1 = require("@nestjs/common");
exports.Protocol = (0, common_1.createParamDecorator)((defaultProtocol, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.protocol;
});
//# sourceMappingURL=protocol.decorator.js.map