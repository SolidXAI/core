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
exports.User = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const role_metadata_entity_1 = require("./role-metadata.entity");
let User = class User extends common_entity_1.CommonEntity {
    constructor() {
        super(...arguments);
        this.forcePasswordChange = true;
        this.lastLoginProvider = "local";
        this.active = true;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { fullName: { required: true, type: () => String }, username: { required: true, type: () => String }, email: { required: true, type: () => String }, mobile: { required: true, type: () => String }, password: { required: true, type: () => String }, forcePasswordChange: { required: true, type: () => Boolean, default: true }, lastLoginProvider: { required: true, type: () => String, default: "local" }, accessCode: { required: true, type: () => String }, googleAccessToken: { required: true, type: () => String }, googleId: { required: true, type: () => String }, googleProfilePicture: { required: true, type: () => String }, active: { required: true, type: () => Boolean, default: true }, forgotPasswordConfirmedAt: { required: true, type: () => Date }, verificationTokenOnForgotPassword: { required: true, type: () => String }, verificationTokenOnForgotPasswordExpiresAt: { required: true, type: () => Date }, emailVerifiedOnRegistrationAt: { required: true, type: () => Date }, emailVerificationTokenOnRegistration: { required: true, type: () => String }, emailVerificationTokenOnRegistrationExpiresAt: { required: true, type: () => Date }, mobileVerifiedOnRegistrationAt: { required: true, type: () => Date }, mobileVerificationTokenOnRegistration: { required: true, type: () => String }, mobileVerificationTokenOnRegistrationExpiresAt: { required: true, type: () => Date }, emailVerifiedOnLoginAt: { required: true, type: () => Date }, emailVerificationTokenOnLogin: { required: true, type: () => String }, emailVerificationTokenOnLoginExpiresAt: { required: true, type: () => Date }, mobileVerifiedOnLoginAt: { required: true, type: () => Date }, mobileVerificationTokenOnLogin: { required: true, type: () => String }, mobileVerificationTokenOnLoginExpiresAt: { required: true, type: () => Date }, customPayload: { required: true, type: () => String }, roles: { required: true, type: () => [require("./role-metadata.entity").RoleMetadata] } };
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "varchar", }),
    __metadata("design:type", String)
], User.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "mobile", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", nullable: true, default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "forcePasswordChange", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", default: "local" }),
    __metadata("design:type", String)
], User.prototype, "lastLoginProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "accessCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "googleAccessToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "googleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "googleProfilePicture", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "forgotPasswordConfirmedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "verificationTokenOnForgotPassword", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "verificationTokenOnForgotPasswordExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "emailVerifiedOnRegistrationAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "emailVerificationTokenOnRegistration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "emailVerificationTokenOnRegistrationExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "mobileVerifiedOnRegistrationAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "mobileVerificationTokenOnRegistration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "mobileVerificationTokenOnRegistrationExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "emailVerifiedOnLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "emailVerificationTokenOnLogin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "emailVerificationTokenOnLoginExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "mobileVerifiedOnLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "mobileVerificationTokenOnLogin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "mobileVerificationTokenOnLoginExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "customPayload", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => role_metadata_entity_1.RoleMetadata, roleMetadata => roleMetadata.users, { cascade: true }),
    (0, typeorm_1.JoinTable)(),
    __metadata("design:type", Array)
], User.prototype, "roles", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)("ss_user"),
    (0, typeorm_1.Index)(["username", "deletedTracker"], { unique: true }),
    (0, typeorm_1.Index)(["email", "deletedTracker"], { unique: true }),
    (0, typeorm_1.Index)(["mobile", "deletedTracker"], { unique: true })
], User);
//# sourceMappingURL=user.entity.js.map