import { BrokerType } from "../interfaces";

const OTP_QUEUE_NAME = 'solid_msg91_otp_queue';

export default {
    name: OTP_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: OTP_QUEUE_NAME,
};