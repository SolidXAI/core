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
exports.CreateEmailTemplateDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const create_email_attachment_dto_1 = require("./create-email-attachment.dto");
const class_transformer_1 = require("class-transformer");
class CreateEmailTemplateDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, body: { required: true, type: () => String }, subject: { required: true, type: () => String, maxLength: 128 }, description: { required: true, type: () => String }, active: { required: true, type: () => Boolean }, attachments: { required: true, type: () => [require("./create-email-attachment.dto").CreateEmailAttachmentDto] } };
    }
}
exports.CreateEmailTemplateDto = CreateEmailTemplateDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(128),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateEmailTemplateDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => create_email_attachment_dto_1.CreateEmailAttachmentDto),
    __metadata("design:type", Array)
], CreateEmailTemplateDto.prototype, "attachments", void 0);
//# sourceMappingURL=create-email-template.dto.js.map