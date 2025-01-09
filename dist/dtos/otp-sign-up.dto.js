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
exports.OTPSignUpDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const constants_1 = require("../constants");
class OTPSignUpDto {
    constructor() {
        this.validationSources = [];
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { username: { required: true, type: () => String }, email: { required: true, type: () => String }, mobile: { required: true, type: () => String }, validationSources: { required: true, default: [], enum: require("../constants").TransactionalRegistrationValidationSource, isArray: true }, customPayload: { required: true, type: () => Object } };
    }
}
exports.OTPSignUpDto = OTPSignUpDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OTPSignUpDto.prototype, "username", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], OTPSignUpDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OTPSignUpDto.prototype, "mobile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(constants_1.TransactionalRegistrationValidationSource, { each: true }),
    __metadata("design:type", Array)
], OTPSignUpDto.prototype, "validationSources", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], OTPSignUpDto.prototype, "customPayload", void 0);
//# sourceMappingURL=otp-sign-up.dto.js.map