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
exports.MqMessageQueue = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const typeorm_1 = require("typeorm");
const mq_message_entity_1 = require("./mq-message.entity");
let MqMessageQueue = class MqMessageQueue extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, description: { required: true, type: () => String }, mqMessages: { required: true, type: () => [require("./mq-message.entity").MqMessage] } };
    }
};
exports.MqMessageQueue = MqMessageQueue;
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", unique: true }),
    __metadata("design:type", String)
], MqMessageQueue.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", unique: true, nullable: true }),
    __metadata("design:type", String)
], MqMessageQueue.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => mq_message_entity_1.MqMessage, mqMessage => mqMessage.mqMessageQueue, { cascade: true }),
    __metadata("design:type", Array)
], MqMessageQueue.prototype, "mqMessages", void 0);
exports.MqMessageQueue = MqMessageQueue = __decorate([
    (0, typeorm_1.Entity)("ss_mq_message_queue")
], MqMessageQueue);
//# sourceMappingURL=mq-message-queue.entity.js.map