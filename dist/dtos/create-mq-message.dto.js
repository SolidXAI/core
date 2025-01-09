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
exports.CreateMqMessageDto = void 0;
const openapi = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const integer_transformer_1 = require("../transformers/integer-transformer");
class CreateMqMessageDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { retryCount: { required: true, type: () => Number }, retryInterval: { required: true, type: () => Number }, messageType: { required: true, type: () => String }, stage: { required: true, type: () => String }, startedAt: { required: true, type: () => Date }, finishedAt: { required: true, type: () => Date }, elapsedMillis: { required: true, type: () => Number }, input: { required: true, type: () => Object }, output: { required: true, type: () => Object }, error: { required: true, type: () => Object }, parentEntityId: { required: true, type: () => Number }, parentEntity: { required: true, type: () => String }, mqMessageQueueId: { required: true, type: () => Number } };
    }
}
exports.CreateMqMessageDto = CreateMqMessageDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateMqMessageDto.prototype, "retryCount", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateMqMessageDto.prototype, "retryInterval", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMqMessageDto.prototype, "messageType", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMqMessageDto.prototype, "stage", void 0);
__decorate([
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], CreateMqMessageDto.prototype, "startedAt", void 0);
__decorate([
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], CreateMqMessageDto.prototype, "finishedAt", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateMqMessageDto.prototype, "elapsedMillis", void 0);
__decorate([
    (0, class_validator_1.IsJSON)(),
    __metadata("design:type", Object)
], CreateMqMessageDto.prototype, "input", void 0);
__decorate([
    (0, class_validator_1.IsJSON)(),
    __metadata("design:type", Object)
], CreateMqMessageDto.prototype, "output", void 0);
__decorate([
    (0, class_validator_1.IsJSON)(),
    __metadata("design:type", Object)
], CreateMqMessageDto.prototype, "error", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_transformer_1.Transform)(integer_transformer_1.default),
    __metadata("design:type", Number)
], CreateMqMessageDto.prototype, "parentEntityId", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMqMessageDto.prototype, "parentEntity", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateMqMessageDto.prototype, "mqMessageQueueId", void 0);
//# sourceMappingURL=create-mq-message.dto.js.map