import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'generate_code_queue';

export default {
    name: 'generateCodeQueue',
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
