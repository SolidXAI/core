import { USER_SUMMARY_FIELDS } from 'src/constants/user.constants';

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

/**
 * Columns of the message author exposed by the chatter APIs.
 *
 * The chatter panel renders `fullName` (name label + initials avatar) and uses `id`
 * for the own-note edit check; the admin list/form/tree views display `fullName` via
 * each view's `coModelFieldToDisplay`. That is exactly the platform-wide summary
 * shape, so this is an alias rather than a second list to keep in step.
 */
export const CHATTER_MESSAGE_USER_FIELDS = USER_SUMMARY_FIELDS;
