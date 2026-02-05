import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_test_queue_db';

export default {
    name: 'queueTestDb',
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
