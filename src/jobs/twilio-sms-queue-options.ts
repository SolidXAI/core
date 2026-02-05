import { BrokerType } from "src/interfaces";

const SMS_QUEUE_NAME = 'solid_twilio_sms_queue_rabbitmq';

export default {
    name: 'twilioSmsInstanceRabbitmq',
    type: BrokerType.RabbitMQ,
    queueName: SMS_QUEUE_NAME,
};