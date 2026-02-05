import { BrokerType } from "src/interfaces";

const SMS_QUEUE_NAME = 'solid_twilio_sms_queue_database';

export default {
    name: SMS_QUEUE_NAME,
    type: BrokerType.Database,
    queueName: SMS_QUEUE_NAME,
};