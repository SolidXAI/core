export type ToolLinkAudit = {
    messageId: number; linkId: number; eventType: string; key?: string;
    createdAt: Date; fieldName: string; oldValue: any; newValue: any;
};
export type ToolLinkState = {
    id: number; agentId: number; toolId: number; requiresApproval: boolean;
    createdAt: Date; deletedAt?: Date | null;
};

const positiveId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : undefined;
const flag = (value: unknown) => [true, 'true', 1, '1'].includes(value as any);

// Reverse complete messages rather than individual fields: delete/insert details
// describe one lifecycle event, and links can be reassigned to another tool/agent.
export function toolLinksAt(agentId: number, at: Date, current: ToolLinkState[], entries: ToolLinkAudit[]) {
    const result = new Map<number, { requiresApproval: boolean }>();
    const ids = new Set([...current.map((link) => link.id), ...entries.map((entry) => entry.linkId)]);
    for (const id of ids) {
        const link = current.find((item) => item.id === id);
        const history = entries.filter((entry) => entry.linkId === id);
        let owner = link?.agentId;
        let tool = link?.toolId;
        let approval = link?.requiresApproval ?? false;
        let present = Boolean(link && (!link.deletedAt || link.deletedAt > at));
        // Audits also retain hard-deleted links. Seed their last known identity.
        const latest = history[history.length - 1];
        if (!link && latest) {
            const key = latest.key?.split(':');
            owner = positiveId(key?.[0]); tool = positiveId(key?.[1]);
            present = latest.eventType !== 'audit_delete';
            for (const entry of history) {
                const value = entry.eventType === 'audit_delete' ? entry.oldValue : entry.newValue;
                if (entry.fieldName === 'agentRegistry') owner = positiveId(value);
                if (entry.fieldName === 'agentToolRegistry') tool = positiveId(value);
                if (entry.fieldName === 'requiresApproval') approval = flag(value);
            }
        }
        const messages = new Map<number, ToolLinkAudit[]>();
        for (const entry of history) messages.set(entry.messageId, [...(messages.get(entry.messageId) ?? []), entry]);
        for (const message of [...messages.values()].reverse()) {
            if (message[0].createdAt <= at) continue;
            const event = message[0].eventType;
            if (event === 'audit_insert') { present = false; continue; }
            if (event === 'audit_delete') present = true;
            for (const entry of message) {
                if (entry.fieldName === 'agentRegistry') owner = positiveId(entry.oldValue);
                if (entry.fieldName === 'agentToolRegistry') tool = positiveId(entry.oldValue);
                if (entry.fieldName === 'agentToolKey' && typeof entry.oldValue === 'string') {
                    const key = entry.oldValue.split(':');
                    owner = positiveId(key[0]); tool = positiveId(key[1]);
                }
                if (entry.fieldName === 'requiresApproval') approval = flag(entry.oldValue);
            }
        }
        if (link && link.createdAt > at) present = false;
        if (present && owner === agentId && tool) result.set(tool, { requiresApproval: approval });
    }
    return result;
}

export function toolFieldAt(entries: { createdAt: Date; fieldName: string; oldValue: any; newValue: any }[], field: string, at: Date, fallback: unknown): string {
    const history = entries.filter((entry) => entry.fieldName === field);
    const before = history.filter((entry) => entry.createdAt <= at);
    return String((before.length ? before[before.length - 1].newValue : history.length ? history[0].oldValue : fallback) ?? '');
}

export const TOOL_COMPARISON_FIELDS = {
    name: 'Name', description: 'Description', type: 'Type', sourceCode: 'Source code',
    status: 'Status', module: 'Module ID', tags: 'Tag IDs', iconName: 'Icon',
    checksum: 'Checksum', lastLoadError: 'Last load error',
};
