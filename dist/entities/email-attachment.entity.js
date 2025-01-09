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
exports.EmailAttachment = void 0;
const openapi = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
const common_entity_1 = require("./common.entity");
const email_template_entity_1 = require("./email-template.entity");
let EmailAttachment = class EmailAttachment extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, relativePath: { required: true, type: () => String }, url: { required: true, type: () => String }, template: { required: true, type: () => String }, emailTemplate: { required: true, type: () => require("./email-template.entity").EmailTemplate } };
    }
};
exports.EmailAttachment = EmailAttachment;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmailAttachment.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmailAttachment.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailAttachment.prototype, "relativePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailAttachment.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailAttachment.prototype, "template", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => email_template_entity_1.EmailTemplate, (template) => template.attachments, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", email_template_entity_1.EmailTemplate)
], EmailAttachment.prototype, "emailTemplate", void 0);
exports.EmailAttachment = EmailAttachment = __decorate([
    (0, typeorm_1.Entity)("ss_email_attachment")
], EmailAttachment);
//# sourceMappingURL=email-attachment.entity.js.map