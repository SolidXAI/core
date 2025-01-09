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
exports.AccessTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const iam_config_1 = require("../config/iam.config");
const constants_1 = require("../constants");
const permission_metadata_service_1 = require("../services/permission-metadata.service");
let AccessTokenGuard = class AccessTokenGuard {
    constructor(jwtService, jwtConfiguration, permissionsService) {
        this.jwtService = jwtService;
        this.jwtConfiguration = jwtConfiguration;
        this.permissionsService = permissionsService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new common_1.UnauthorizedException();
        }
        try {
            const payload = await this.jwtService.verifyAsync(token, this.jwtConfiguration);
            const permissions = await this.permissionsService.findAllUsingRoles(payload.roles);
            payload.permissions = permissions.map((permission) => permission.name);
            request[constants_1.REQUEST_USER_KEY] = payload;
        }
        catch {
            throw new common_1.UnauthorizedException();
        }
        return true;
    }
    extractTokenFromHeader(request) {
        const [_, token] = request.headers.authorization?.split(' ') ?? [];
        return token;
    }
};
exports.AccessTokenGuard = AccessTokenGuard;
exports.AccessTokenGuard = AccessTokenGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(iam_config_1.jwtConfig.KEY)),
    __metadata("design:paramtypes", [jwt_1.JwtService, void 0, permission_metadata_service_1.PermissionMetadataService])
], AccessTokenGuard);
//# sourceMappingURL=access-token.guard.js.map