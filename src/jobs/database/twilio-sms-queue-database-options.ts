import { BrokerType } from "src/interfaces";

const SMS_QUEUE_NAME = 'twilio_sms_queue_database';

export default {
    name: 'twilioSmsInstance',
    type: BrokerType.Database,
    queueName: SMS_QUEUE_NAME,
};