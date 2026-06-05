import { BrokerType } from "../../interfaces";

const QUEUE_NAME = "solid_onesignal_push_notification_queue_v1";

export default {
  name: QUEUE_NAME,
  type: BrokerType.RabbitMQ,
  queueName: QUEUE_NAME,
};
