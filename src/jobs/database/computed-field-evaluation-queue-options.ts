import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'computed_field_evaluation_queue';

export default {
    name: 'compuatedFieldEvaluationQueue',
    type: BrokerType.Database,
    queueName: QUEUE_NAME,
};
