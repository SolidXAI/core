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
exports.OTPAuthenticationController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorator_1 = require("../decorators/auth.decorator");
const public_decorator_1 = require("../decorators/public.decorator");
const otp_confirm_otp_dto_1 = require("../dtos/otp-confirm-otp.dto");
const otp_sign_in_dto_1 = require("../dtos/otp-sign-in.dto");
const otp_sign_up_dto_1 = require("../dtos/otp-sign-up.dto");
const auth_type_enum_1 = require("../enums/auth-type.enum");
const authentication_service_1 = require("../services/authentication.service");
let OTPAuthenticationController = class OTPAuthenticationController {
    constructor(authService) {
        this.authService = authService;
    }
    initiateRegistration(signUpDto) {
        return this.authService.otpInitiateRegistration(signUpDto);
    }
    async confirmRegistration(response, signInDto) {
        return this.authService.otpConfirmRegistration(signInDto);
    }
    initiateLogin(signInDto) {
        return this.authService.otpInitiateLogin(signInDto);
    }
    async confirmLogin(response, signInDto) {
        return this.authService.otpConfirmLogin(signInDto);
    }
};
exports.OTPAuthenticationController = OTPAuthenticationController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register/initiate'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [otp_sign_up_dto_1.OTPSignUpDto]),
    __metadata("design:returntype", void 0)
], OTPAuthenticationController.prototype, "initiateRegistration", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('register/confirm'),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, otp_confirm_otp_dto_1.OTPConfirmOTPDto]),
    __metadata("design:returntype", Promise)
], OTPAuthenticationController.prototype, "confirmRegistration", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login/initiate'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [otp_sign_in_dto_1.OTPSignInDto]),
    __metadata("design:returntype", void 0)
], OTPAuthenticationController.prototype, "initiateLogin", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('login/confirm'),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, otp_confirm_otp_dto_1.OTPConfirmOTPDto]),
    __metadata("design:returntype", Promise)
], OTPAuthenticationController.prototype, "confirmLogin", null);
exports.OTPAuthenticationController = OTPAuthenticationController = __decorate([
    (0, auth_decorator_1.Auth)(auth_type_enum_1.AuthType.None),
    (0, common_1.Controller)('iam/otp'),
    (0, swagger_1.ApiTags)("Iam"),
    __metadata("design:paramtypes", [authentication_service_1.AuthenticationService])
], OTPAuthenticationController);
//# sourceMappingURL=otp-authentication.controller.js.map