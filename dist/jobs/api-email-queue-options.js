"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("../interfaces");
const API_MAIL_QUEUE_NAME = 'api_mail_queue';
exports.default = {
    name: 'apiMailInstance',
    type: interfaces_1.BrokerType.RabbitMQ,
    queueName: API_MAIL_QUEUE_NAME,
};
//# sourceMappingURL=api-email-queue-options.js.map