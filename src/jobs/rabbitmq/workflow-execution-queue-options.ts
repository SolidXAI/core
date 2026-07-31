import { BrokerType } from '../../interfaces';

const QUEUE_NAME = 'solid_workflow_execution_queue_rabbitmq';

export default {
  name: QUEUE_NAME,
  type: BrokerType.RabbitMQ,
  queueName: QUEUE_NAME,
};
