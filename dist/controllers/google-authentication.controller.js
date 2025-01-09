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
exports.GoogleAuthenticationController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const authentication_service_1 = require("../services/authentication.service");
const auth_decorator_1 = require("../decorators/auth.decorator");
const auth_type_enum_1 = require("../enums/auth-type.enum");
const swagger_1 = require("@nestjs/swagger");
const google_oauth_strategy_1 = require("../passport-strategies/google-oauth.strategy");
const user_service_1 = require("../services/user.service");
const public_decorator_1 = require("../decorators/public.decorator");
const iam_config_1 = require("../config/iam.config");
let GoogleAuthenticationController = class GoogleAuthenticationController {
    constructor(iamConfiguration, userService, authService) {
        this.iamConfiguration = iamConfiguration;
        this.userService = userService;
        this.authService = authService;
    }
    async connect() { }
    googleAuthCallback(req, res) {
        const user = req.user;
        return res.redirect(`${this.iamConfiguration.googleOauth.redirectURL}?accessCode=${user['accessCode']}`);
    }
    async dummyGoogleAuthRedirect(accessCode) {
        const user = await this.userService.findOneByAccessCode(accessCode);
        delete user['password'];
        return user;
    }
    async googleAuth(accessCode) {
        return this.authService.signInUsingGoogle(accessCode);
    }
};
exports.GoogleAuthenticationController = GoogleAuthenticationController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(google_oauth_strategy_1.GoogleOauthGuard),
    (0, common_1.Get)('connect'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GoogleAuthenticationController.prototype, "connect", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('connect/callback'),
    (0, common_1.UseGuards)(google_oauth_strategy_1.GoogleOauthGuard),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], GoogleAuthenticationController.prototype, "googleAuthCallback", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('dummy-redirect'),
    openapi.ApiResponse({ status: 200, type: require("../entities/user.entity").User }),
    __param(0, (0, common_1.Query)('accessCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GoogleAuthenticationController.prototype, "dummyGoogleAuthRedirect", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('authenticate'),
    (0, swagger_1.ApiQuery)({ name: 'accessCode', required: true, type: String }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('accessCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GoogleAuthenticationController.prototype, "googleAuth", null);
exports.GoogleAuthenticationController = GoogleAuthenticationController = __decorate([
    (0, auth_decorator_1.Auth)(auth_type_enum_1.AuthType.None),
    (0, common_1.Controller)('iam/google'),
    (0, swagger_1.ApiTags)("Iam"),
    __param(0, (0, common_1.Inject)(iam_config_1.iamConfig.KEY)),
    __metadata("design:paramtypes", [void 0, user_service_1.UserService,
        authentication_service_1.AuthenticationService])
], GoogleAuthenticationController);
//# sourceMappingURL=google-authentication.controller.js.map