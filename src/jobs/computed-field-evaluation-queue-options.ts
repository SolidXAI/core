import { BrokerType } from "../interfaces";

const QUEUE_NAME = 'solid_computed_field_evaluation_queue';

export default {
    name: 'computedFieldEvaluationQueue',
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
};
