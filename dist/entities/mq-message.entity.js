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
exports.MqMessage = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const mq_message_queue_entity_1 = require("./mq-message-queue.entity");
let MqMessage = class MqMessage extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { messageId: { required: true, type: () => String }, retryCount: { required: true, type: () => Number }, retryInterval: { required: true, type: () => Number }, messageType: { required: true, type: () => String }, stage: { required: true, type: () => String }, startedAt: { required: true, type: () => Date }, finishedAt: { required: true, type: () => Date }, elapsedMillis: { required: true, type: () => Number }, input: { required: true, type: () => Object }, output: { required: true, type: () => Object }, error: { required: true, type: () => Object }, parentEntityId: { required: true, type: () => Number }, parentEntity: { required: true, type: () => String }, mqMessageQueue: { required: true, type: () => require("./mq-message-queue.entity").MqMessageQueue } };
    }
};
exports.MqMessage = MqMessage;
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], MqMessage.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Number)
], MqMessage.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Number)
], MqMessage.prototype, "retryInterval", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], MqMessage.prototype, "messageType", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "varchar" }),
    __metadata("design:type", String)
], MqMessage.prototype, "stage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], MqMessage.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], MqMessage.prototype, "finishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Number)
], MqMessage.prototype, "elapsedMillis", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], MqMessage.prototype, "input", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], MqMessage.prototype, "output", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], MqMessage.prototype, "error", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Number)
], MqMessage.prototype, "parentEntityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], MqMessage.prototype, "parentEntity", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => mq_message_queue_entity_1.MqMessageQueue, { onDelete: "CASCADE" }),
    __metadata("design:type", mq_message_queue_entity_1.MqMessageQueue)
], MqMessage.prototype, "mqMessageQueue", void 0);
exports.MqMessage = MqMessage = __decorate([
    (0, typeorm_1.Entity)("ss_mq_message")
], MqMessage);
//# sourceMappingURL=mq-message.entity.js.map