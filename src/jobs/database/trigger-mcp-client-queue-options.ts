import { BrokerType } from "src/interfaces";

const TRIGGER_MCP_CLIENT_QUEUE_NAME = 'trigger_mcp_client_queue';

export default {
    name: 'triggerMcpClientQueue',
    type: BrokerType.Database,
    queueName: TRIGGER_MCP_CLIENT_QUEUE_NAME,
};
