import { BrokerType } from "../../interfaces";

const MAIL_QUEUE_NAME = "solid_amazon_ses_email_queue_v1";

export default {
  name: MAIL_QUEUE_NAME,
  type: BrokerType.RabbitMQ,
  queueName: MAIL_QUEUE_NAME,
};
