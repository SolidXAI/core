export const CHATTER_MESSAGE_TYPE = {
    AUDIT: 'audit',
    CUSTOM: 'custom',
} as const;

export const CHATTER_MESSAGE_SUBTYPE = {
    AUDIT_INSERT: 'audit_insert',
    AUDIT_UPDATE: 'audit_update',
    AUDIT_DELETE: 'audit_delete',
    CUSTOM: 'custom',
    NOTE: 'note',
    TASK: 'task',
} as const;

export const CHATTER_MESSAGE_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
} as const;
