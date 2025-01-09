"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("../interfaces");
const SMS_QUEUE_NAME = 'sms_queue';
exports.default = {
    name: 'smsInstance',
    type: interfaces_1.BrokerType.RabbitMQ,
    queueName: SMS_QUEUE_NAME,
};
//# sourceMappingURL=sms-queue-options.js.map