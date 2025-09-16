import { BrokerType } from "src/interfaces";

const TRIGGER_MCP_CLIENT_QUEUE_NAME = 'trigger_mcp_client_queue_rabbitmq';

export default {
    name: 'triggerMcpClientQueueRabbitmq',
    type: BrokerType.RabbitMQ,
    queueName: TRIGGER_MCP_CLIENT_QUEUE_NAME,
};
