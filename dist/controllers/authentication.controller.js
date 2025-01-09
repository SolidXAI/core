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
var AuthenticationController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const authentication_service_1 = require("../services/authentication.service");
const sign_in_dto_1 = require("../dtos/sign-in.dto");
const sign_up_dto_1 = require("../dtos/sign-up.dto");
const refresh_token_dto_1 = require("../dtos/refresh-token.dto");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../decorators/public.decorator");
const initiate_forgot_password_dto_1 = require("../dtos/initiate-forgot-password.dto");
const confirm_forgot_password_dto_1 = require("../dtos/confirm-forgot-password.dto");
const change_password_dto_1 = require("../dtos/change-password.dto");
const active_user_decorator_1 = require("../decorators/active-user.decorator");
let AuthenticationController = AuthenticationController_1 = class AuthenticationController {
    constructor(authService) {
        this.authService = authService;
        this.logger = new common_1.Logger(AuthenticationController_1.name);
    }
    signUp(signUpDto) {
        return this.authService.signUp(signUpDto);
    }
    signUpPrivate(signUpDto, activeUser) {
        return this.authService.signUp(signUpDto, activeUser);
    }
    async signIn(response, signInDto) {
        return this.authService.signIn(signInDto);
    }
    refreshTokens(refreshTokenDto) {
        return this.authService.refreshTokens(refreshTokenDto);
    }
    initiateForgotPassword(initiateForgotPasswordDto) {
        return this.authService.initiateForgotPassword(initiateForgotPasswordDto);
    }
    confirmForgotPassword(confirmForgotPasswordDto) {
        return this.authService.confirmForgotPassword(confirmForgotPasswordDto);
    }
    changePassword(changePasswordDto, activeUser) {
        return this.authService.changePassword(changePasswordDto, activeUser);
    }
    me(activeUser) {
        return this.authService.me(activeUser);
    }
    async logout() {
        return this.authService.logout();
    }
};
exports.AuthenticationController = AuthenticationController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    openapi.ApiResponse({ status: 201, type: require("../entities/user.entity").User }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sign_up_dto_1.SignUpDto]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "signUp", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)('register-private'),
    openapi.ApiResponse({ status: 201, type: require("../entities/user.entity").User }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, active_user_decorator_1.ActiveUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sign_up_dto_1.SignUpDto, Object]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "signUpPrivate", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('authenticate'),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sign_in_dto_1.SignInDto]),
    __metadata("design:returntype", Promise)
], AuthenticationController.prototype, "signIn", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('refresh-tokens'),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "refreshTokens", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('initiate/forgot-password'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [initiate_forgot_password_dto_1.InitiateForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "initiateForgotPassword", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('confirm/forgot-password'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [confirm_forgot_password_dto_1.ConfirmForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "confirmForgotPassword", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)('change-password'),
    openapi.ApiResponse({ status: 201, type: Boolean }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, active_user_decorator_1.ActiveUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [change_password_dto_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "changePassword", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Get)('me'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, active_user_decorator_1.ActiveUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthenticationController.prototype, "me", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthenticationController.prototype, "logout", null);
exports.AuthenticationController = AuthenticationController = AuthenticationController_1 = __decorate([
    (0, common_1.Controller)('iam'),
    (0, swagger_1.ApiTags)("Iam"),
    __metadata("design:paramtypes", [authentication_service_1.AuthenticationService])
], AuthenticationController);
//# sourceMappingURL=authentication.controller.js.map