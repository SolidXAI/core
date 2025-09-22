import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'computed_field_evaluation_queue_database';

export default {
    name: 'computedFieldEvaluationQueueDatabase',
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
