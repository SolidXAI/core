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
exports.SmsTemplate = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
let SmsTemplate = class SmsTemplate extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, body: { required: true, type: () => String }, smsProviderTemplateId: { required: true, type: () => String }, description: { required: true, type: () => String }, active: { required: true, type: () => Boolean } };
    }
};
exports.SmsTemplate = SmsTemplate;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], SmsTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SmsTemplate.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], SmsTemplate.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SmsTemplate.prototype, "smsProviderTemplateId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], SmsTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], SmsTemplate.prototype, "active", void 0);
exports.SmsTemplate = SmsTemplate = __decorate([
    (0, typeorm_1.Entity)("ss_sms_template")
], SmsTemplate);
//# sourceMappingURL=sms-template.entity.js.map