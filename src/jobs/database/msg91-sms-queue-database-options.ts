import { BrokerType } from "src/interfaces";

const SMS_QUEUE_NAME = 'solid_sms_queue_database';
export default {
    name: 'smsInstance',
    type: BrokerType.Database,
    queueName: SMS_QUEUE_NAME,
};