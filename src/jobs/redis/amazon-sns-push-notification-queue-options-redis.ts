import { BrokerType } from "../../interfaces";

const QUEUE_NAME = "solid_amazon_sns_push_notification_queue_redis_v1";

export default {
  name: QUEUE_NAME,
  type: BrokerType.Redis,
  queueName: QUEUE_NAME,
};
