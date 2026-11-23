import { toolFieldAt, toolLinksAt, ToolLinkAudit, ToolLinkState } from './agent-tool-comparison';

const at = (day: number) => new Date(`2026-11-${day}T12:00:00Z`);
const link: ToolLinkState = { id: 10, agentId: 1, toolId: 2, requiresApproval: true, createdAt: at(10) };
const audit = (overrides: Partial<ToolLinkAudit>): ToolLinkAudit => ({
    messageId: 1, linkId: 10, eventType: 'audit_update', createdAt: at(15),
    fieldName: 'requiresApproval', oldValue: 'false', newValue: 'true', ...overrides,
});

describe('toolLinksAt', () => {
    it('resolves approval before and at the edit boundary', () => {
        expect(toolLinksAt(1, at(14), [link], [audit({})]).get(2)?.requiresApproval).toBe(false);
        expect(toolLinksAt(1, at(15), [link], [audit({})]).get(2)?.requiresApproval).toBe(true);
    });
    it('excludes links created after a version even without audit history', () => {
        expect(toolLinksAt(1, at(11), [{ ...link, createdAt: at(12) }], []).size).toBe(0);
    });
    it('restores soft and hard deleted links from complete delete messages', () => {
        const entries = [
            audit({ eventType: 'audit_delete', fieldName: 'agentRegistry', oldValue: '1', newValue: null }),
            audit({ eventType: 'audit_delete', fieldName: 'agentToolRegistry', oldValue: '2', newValue: null }),
            audit({ eventType: 'audit_delete', oldValue: 'true', newValue: null }),
        ];
        const current = [{ ...link, deletedAt: at(15) }];
        expect(toolLinksAt(1, at(14), current, entries).get(2)?.requiresApproval).toBe(true);
        expect(toolLinksAt(1, at(15), current, entries).size).toBe(0);
        expect(toolLinksAt(1, at(14), [], entries).has(2)).toBe(true);
    });
    it('keeps delete and re-add events on different links independent', () => {
        const current = [{ ...link, deletedAt: at(14) }, { ...link, id: 11, createdAt: at(16), requiresApproval: false }];
        const entries = [
            audit({ eventType: 'audit_delete', createdAt: at(14), oldValue: 'true', newValue: null }),
            audit({ messageId: 2, linkId: 11, eventType: 'audit_insert', createdAt: at(16), oldValue: null, newValue: 'false' }),
        ];
        expect(toolLinksAt(1, at(13), current, entries).get(2)?.requiresApproval).toBe(true);
        expect(toolLinksAt(1, at(15), current, entries).size).toBe(0);
        expect(toolLinksAt(1, at(17), current, entries).get(2)?.requiresApproval).toBe(false);
    });
    it('resolves tool and agent reassignments', () => {
        const entries = [audit({ fieldName: 'agentToolRegistry', oldValue: '2', newValue: '3' }),
            audit({ messageId: 2, createdAt: at(17), fieldName: 'agentRegistry', oldValue: '1', newValue: '4' })];
        const current = [{ ...link, agentId: 4, toolId: 3 }];
        expect([...toolLinksAt(1, at(14), current, entries).keys()]).toEqual([2]);
        expect([...toolLinksAt(1, at(16), current, entries).keys()]).toEqual([3]);
        expect(toolLinksAt(1, at(18), current, entries).size).toBe(0);
    });
});

describe('toolFieldAt', () => {
    const entries = [audit({ fieldName: 'sourceCode', oldValue: 'original', newValue: 'version two' }),
        audit({ messageId: 2, createdAt: at(19), fieldName: 'sourceCode', oldValue: 'version two', newValue: 'later edit' })];
    it('resolves historical source, ignoring edits after the selected versions', () => {
        expect(toolFieldAt(entries, 'sourceCode', at(14), 'current')).toBe('original');
        expect(toolFieldAt(entries, 'sourceCode', at(15), 'current')).toBe('version two');
        expect(toolFieldAt(entries, 'sourceCode', at(20), 'current')).toBe('later edit');
    });
    it('falls back to current values only for fields without history', () => {
        expect(toolFieldAt(entries, 'name', at(14), 'tool')).toBe('tool');
        expect(toolFieldAt(entries, 'description', at(14), null)).toBe('');
    });
});
