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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class UpdateUserDto {
    constructor() {
        this.forcePasswordChange = true;
        this.lastLoginProvider = "local";
        this.active = true;
        this.forgotPasswordConfirmedAt = new Date("1970-01-01T00:00:00.000Z");
        this.verificationTokenOnForgotPasswordExpiresAt = new Date("1970-01-01T00:00:00.000Z");
        this.emailVerifiedOnRegistrationAt = new Date("1970-01-01T00:00:00.000Z");
        this.emailVerificationTokenOnRegistrationExpiresAt = new Date("1970-01-01T00:00:00.000Z");
        this.mobileVerifiedOnRegistrationAt = new Date("1970-01-01T00:00:00.000Z");
        this.mobileVerificationTokenOnRegistrationExpiresAt = new Date("1970-01-01T00:00:00.000Z");
        this.emailVerifiedOnLoginAt = new Date("1970-01-01T00:00:00.000Z");
        this.emailVerificationTokenOnLoginExpiresAt = new Date("1970-01-01T00:00:00.000Z");
        this.mobileVerifiedOnLoginAt = new Date("1970-01-01T00:00:00.000Z");
        this.mobileVerificationTokenOnLoginExpiresAt = new Date("1970-01-01T00:00:00.000Z");
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => Number }, fullName: { required: true, type: () => String }, username: { required: true, type: () => String }, email: { required: true, type: () => String }, mobile: { required: true, type: () => String }, password: { required: true, type: () => String, pattern: "/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).*$/" }, passwordConfirm: { required: true, type: () => String, pattern: "/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).*$/" }, forcePasswordChange: { required: true, type: () => Boolean, default: true }, lastLoginProvider: { required: true, type: () => String, default: "local" }, accessCode: { required: true, type: () => String }, googleAccessToken: { required: true, type: () => String }, googleId: { required: true, type: () => String }, googleProfilePicture: { required: true, type: () => String }, active: { required: true, type: () => Boolean, default: true }, forgotPasswordConfirmedAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, verificationTokenOnForgotPassword: { required: true, type: () => String }, verificationTokenOnForgotPasswordExpiresAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, emailVerifiedOnRegistrationAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, emailVerificationTokenOnRegistration: { required: true, type: () => String }, emailVerificationTokenOnRegistrationExpiresAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, mobileVerifiedOnRegistrationAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, mobileVerificationTokenOnRegistration: { required: true, type: () => String }, mobileVerificationTokenOnRegistrationExpiresAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, emailVerifiedOnLoginAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, emailVerificationTokenOnLogin: { required: true, type: () => String }, emailVerificationTokenOnLoginExpiresAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, mobileVerifiedOnLoginAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, mobileVerificationTokenOnLogin: { required: true, type: () => String }, mobileVerificationTokenOnLoginExpiresAt: { required: true, type: () => Date, default: new Date("1970-01-01T00:00:00.000Z") }, customPayload: { required: true, type: () => String } };
    }
}
exports.UpdateUserDto = UpdateUserDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateUserDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "fullName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "username", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "mobile", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "passwordConfirm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "forcePasswordChange", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "lastLoginProvider", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "accessCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "googleAccessToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "googleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "googleProfilePicture", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "forgotPasswordConfirmedAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "verificationTokenOnForgotPassword", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "verificationTokenOnForgotPasswordExpiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "emailVerifiedOnRegistrationAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "emailVerificationTokenOnRegistration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "emailVerificationTokenOnRegistrationExpiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "mobileVerifiedOnRegistrationAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "mobileVerificationTokenOnRegistration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "mobileVerificationTokenOnRegistrationExpiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "emailVerifiedOnLoginAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "emailVerificationTokenOnLogin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "emailVerificationTokenOnLoginExpiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "mobileVerifiedOnLoginAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "mobileVerificationTokenOnLogin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], UpdateUserDto.prototype, "mobileVerificationTokenOnLoginExpiresAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "customPayload", void 0);
//# sourceMappingURL=update-user.dto.js.map