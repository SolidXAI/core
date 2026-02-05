import { BrokerType } from "src/interfaces";

const OTP_QUEUE_NAME = 'solid_otp_queue_database';
export default {
    name: 'otpInstance',
    type: BrokerType.Database,
    queueName: OTP_QUEUE_NAME,
};