import { QueueMessage } from 'src/interfaces/mq';

import { BrokerType } from "../interfaces";

const SMS_QUEUE_NAME = 'solid_msg91_sms_queue';

export default {
    name: SMS_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: SMS_QUEUE_NAME,
};