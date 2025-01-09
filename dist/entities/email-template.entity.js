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
exports.EmailTemplate = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const email_attachment_entity_1 = require("./email-attachment.entity");
let EmailTemplate = class EmailTemplate extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, body: { required: true, type: () => String }, subject: { required: true, type: () => String }, description: { required: true, type: () => String }, active: { required: true, type: () => Boolean }, attachments: { required: true, type: () => [require("./email-attachment.entity").EmailAttachment] } };
    }
};
exports.EmailTemplate = EmailTemplate;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmailTemplate.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 128 }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EmailTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EmailTemplate.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => email_attachment_entity_1.EmailAttachment, (attachment) => attachment.emailTemplate, { cascade: true }),
    __metadata("design:type", Array)
], EmailTemplate.prototype, "attachments", void 0);
exports.EmailTemplate = EmailTemplate = __decorate([
    (0, typeorm_1.Entity)("ss_email_template")
], EmailTemplate);
//# sourceMappingURL=email-template.entity.js.map