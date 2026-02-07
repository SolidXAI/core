import { BrokerType } from "src/interfaces";


const MAIL_QUEUE_NAME = 'solid_email_db_queue_v3';

export default {
    name: MAIL_QUEUE_NAME,
    type: BrokerType.Database,
    queueName: MAIL_QUEUE_NAME,
};
