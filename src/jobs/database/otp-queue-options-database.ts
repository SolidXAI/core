import { BrokerType } from "src/interfaces";

const OTP_QUEUE_NAME = 'solid_msg91_otp_queue_database';

export default {
    name: OTP_QUEUE_NAME,
    type: BrokerType.Database,
    queueName: OTP_QUEUE_NAME,
};