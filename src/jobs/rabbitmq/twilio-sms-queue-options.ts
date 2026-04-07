import { BrokerType } from "../../interfaces";

const SMS_QUEUE_NAME = 'solid_twilio_sms_queue_rabbitmq';

export default {
    name: SMS_QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: SMS_QUEUE_NAME,
};
