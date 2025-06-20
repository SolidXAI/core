import { BrokerType } from "src/interfaces";

const API_MAIL_QUEUE_NAME = 'api_mail_queue_database';

export default {
    name: 'apiMailInstance',
    type: BrokerType.Database,
    queueName: API_MAIL_QUEUE_NAME,
};
