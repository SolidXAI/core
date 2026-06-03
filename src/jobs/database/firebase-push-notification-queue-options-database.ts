import { BrokerType } from "src/interfaces";

const QUEUE_NAME = "solid_firebase_push_notification_db_queue_v1";

export default {
  name: QUEUE_NAME,
  type: BrokerType.Database,
  queueName: QUEUE_NAME,
};
