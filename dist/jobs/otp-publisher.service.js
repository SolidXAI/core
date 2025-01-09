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
exports.OTPQueuePublisher = void 0;
const common_1 = require("@nestjs/common");
const rabbitmq_publisher_service_1 = require("../services/rabbitmq-publisher.service");
const otp_queue_options_1 = require("./otp-queue-options");
const mq_message_queue_service_1 = require("../services/mq-message-queue.service");
const mq_message_service_1 = require("../services/mq-message.service");
let OTPQueuePublisher = class OTPQueuePublisher extends rabbitmq_publisher_service_1.RabbitMqPublisher {
    constructor(mqMessageService, mqMessageQueueService) {
        super(mqMessageService, mqMessageQueueService);
        this.mqMessageService = mqMessageService;
        this.mqMessageQueueService = mqMessageQueueService;
    }
    options() {
        return {
            ...otp_queue_options_1.default
        };
    }
};
exports.OTPQueuePublisher = OTPQueuePublisher;
exports.OTPQueuePublisher = OTPQueuePublisher = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mq_message_service_1.MqMessageService,
        mq_message_queue_service_1.MqMessageQueueService])
], OTPQueuePublisher);
//# sourceMappingURL=otp-publisher.service.js.map