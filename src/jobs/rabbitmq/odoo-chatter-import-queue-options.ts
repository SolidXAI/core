import { BrokerType } from "../../interfaces";

const QUEUE_NAME = 'solid_odoo_chatter_import_queue';

export interface OdooChatterImportQueuePayload {
    odooModelName: string;
    odooBaseUrl: string;
    /** Odoo `session_id` cookie obtained once, synchronously, before publishing - never the raw password. */
    odooSessionCookie: string;
    /** SolidX model, e.g. "frmsLead" - already lower-camel-cased, matches ChatterMessage.coModelName. */
    solidxModelName: string;
    /** Import only the SolidX record whose `odooId` equals this value; omit to sweep every record with a non-null `odooId`. */
    odooId?: number;
    fromDate?: string;
    batchSize: number;
}

export default {
    name: QUEUE_NAME,
    type: BrokerType.RabbitMQ,
    queueName: QUEUE_NAME,
    // Avoid persisting the Odoo session cookie into the mq_message table.
    persistToDatabase: false,
};
