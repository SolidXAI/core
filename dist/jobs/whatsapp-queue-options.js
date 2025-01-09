"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("../interfaces");
const WHATSAPP_QUEUE_NAME = 'whatsapp_queue';
exports.default = {
    name: 'whatsappInstance',
    type: interfaces_1.BrokerType.RabbitMQ,
    queueName: WHATSAPP_QUEUE_NAME,
};
//# sourceMappingURL=whatsapp-queue-options.js.map