import { compareAgentGeneralConfig } from './agent-general-config-comparison';

const date = (day: number) => new Date(`2026-11-${day}T12:00:00Z`);
const older = date(12), newer = date(16);
const entry = (fieldName: string, day: number, oldValue: unknown, newValue: unknown) => ({ fieldName, createdAt: date(day), oldValue, newValue });
const field = (key: string, current: Record<string, unknown>, entries = []) =>
    compareAgentGeneralConfig(current, entries, older, newer).fields.find((item) => item.key === key);

describe('general configuration comparison', () => {
    it('resolves runner at version dates, ignoring subsequent runner changes', () => {
        expect(field('runner', { runner: 'ecs' }, [entry('runner', 14, 'local', 'docker'), entry('runner', 19, 'docker', 'ecs')]))
            .toMatchObject({ label: 'Runner', status: 'changed', left: 'local', right: 'docker' });
    });
    it('includes the newer boundary and excludes the older boundary from change detection', () => {
        expect(field('stepLimit', {}, [entry('stepLimit', 12, '10', '20')])).toMatchObject({ status: 'matched', left: '20', right: '20' });
        expect(field('stepLimit', {}, [entry('stepLimit', 16, '10', '20')])).toMatchObject({ status: 'changed', left: '10', right: '20' });
    });
    it.each(['minProcesses', 'maxProcesses', 'processCpu', 'processMemory', 'stepLimit', 'turnStepLimit', 'costLimit'])('includes changes to %s and preserves zero', (key) => {
        expect(field(key, {}, [entry(key, 14, 0, 100)])).toMatchObject({ status: 'changed', left: '0', right: '100' });
    });
    it('provides explicit descriptions for inherited values', () => {
        expect(field('runner', {}, [entry('runner', 14, 'local', '')])).toMatchObject({ right: null, emptyLabel: 'Installation default' });
        expect(field('processCpu', {})).toMatchObject({ left: null, right: null, emptyLabel: 'Task definition default' });
        expect(field('maxProcesses', {})).toMatchObject({ emptyLabel: 'Installation limit' });
    });
    it('does not mistake current values or future edits for historical differences', () => {
        expect(field('runner', { runner: 'ecs' }, [entry('runner', 19, 'local', 'ecs')])).toMatchObject({ status: 'matched', left: 'local', right: 'local' });
        expect(compareAgentGeneralConfig({ stepLimit: 100 }, [], older, newer).status).toBe('matched');
    });
    it('includes agent metadata and required input changes inline', () => {
        for (const key of ['name', 'title', 'description', 'iconName', 'requiredInputs']) {
            expect(field(key, {}, [entry(key, 14, 'old', 'new')])).toMatchObject({ status: 'changed', left: 'old', right: 'new' });
        }
    });
    it('excludes activation metadata and fields already compared in dedicated sections', () => {
        const result = compareAgentGeneralConfig({}, [entry('configVersion', 14, 1, 2), entry('status', 14, 'draft', 'active')], older, newer);
        expect(result.status).toBe('matched');
        for (const key of ['systemPrompt', 'reasoningModelKey', 'fastModelKey', 'status', 'configVersion']) {
            expect(result.fields.map((item) => item.key)).not.toContain(key);
        }
    });
});
