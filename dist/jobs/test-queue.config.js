"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("../interfaces");
const QUEUE_NAME = 'test_queue';
exports.default = {
    name: 'queueTest',
    type: interfaces_1.BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
//# sourceMappingURL=test-queue.config.js.map