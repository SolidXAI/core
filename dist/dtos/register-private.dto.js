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
exports.RegisterPrivateDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class RegisterPrivateDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { username: { required: true, type: () => String }, email: { required: true, type: () => String }, mobile: { required: false, type: () => String }, password: { required: false, type: () => String, minLength: 10 } };
    }
}
exports.RegisterPrivateDto = RegisterPrivateDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterPrivateDto.prototype, "username", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterPrivateDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterPrivateDto.prototype, "mobile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], RegisterPrivateDto.prototype, "password", void 0);
//# sourceMappingURL=register-private.dto.js.map