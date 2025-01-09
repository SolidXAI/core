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
exports.WhatsappQueueSubscriber = void 0;
const common_1 = require("@nestjs/common");
const rabbitmq_subscriber_service_1 = require("../services/rabbitmq-subscriber.service");
const whatsapp_queue_options_1 = require("./whatsapp-queue-options");
const Msg91WhatsappService_1 = require("../services/whatsapp/Msg91WhatsappService");
const mq_message_service_1 = require("../services/mq-message.service");
const mq_message_queue_service_1 = require("../services/mq-message-queue.service");
let WhatsappQueueSubscriber = class WhatsappQueueSubscriber extends rabbitmq_subscriber_service_1.RabbitMqSubscriber {
    constructor(whatsappService, mqMessageService, mqMessageQueueService) {
        super(mqMessageService, mqMessageQueueService);
        this.whatsappService = whatsappService;
        this.mqMessageService = mqMessageService;
        this.mqMessageQueueService = mqMessageQueueService;
    }
    options() {
        return {
            ...whatsapp_queue_options_1.default
        };
    }
    subscribe(message) {
        this.whatsappService.sendSMSSynchronously(message);
    }
};
exports.WhatsappQueueSubscriber = WhatsappQueueSubscriber;
exports.WhatsappQueueSubscriber = WhatsappQueueSubscriber = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Msg91WhatsappService_1.Msg91WhatsappService,
        mq_message_service_1.MqMessageService,
        mq_message_queue_service_1.MqMessageQueueService])
], WhatsappQueueSubscriber);
//# sourceMappingURL=whatsapp-subscriber.service.js.map