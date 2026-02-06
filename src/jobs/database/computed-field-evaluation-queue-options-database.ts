import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_computed_field_evaluation_queue_database';

export default {
    name: QUEUE_NAME,
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
