"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interfaces_1 = require("../interfaces");
const OTP_QUEUE_NAME = 'otp_queue';
exports.default = {
    name: 'otpInstance',
    type: interfaces_1.BrokerType.RabbitMQ,
    queueName: OTP_QUEUE_NAME,
};
//# sourceMappingURL=otp-queue-options.js.map