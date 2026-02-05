import { BrokerType } from "src/interfaces";

const TRIGGER_MCP_CLIENT_QUEUE_NAME = 'solid_trigger_mcp_client_queue';

export default {
    name: TRIGGER_MCP_CLIENT_QUEUE_NAME,
    type: BrokerType.Database,
    queueName: TRIGGER_MCP_CLIENT_QUEUE_NAME,
};
