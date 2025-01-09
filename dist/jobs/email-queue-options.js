"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("../interfaces");
const MAIL_QUEUE_NAME = 'solid_email_queue_v3';
exports.default = {
    name: 'solidEmailInstance',
    type: interfaces_1.BrokerType.RabbitMQ,
    queueName: MAIL_QUEUE_NAME,
};
//# sourceMappingURL=email-queue-options.js.map