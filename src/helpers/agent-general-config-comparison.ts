// Lifecycle status and configVersion are deliberately excluded: activation changes
// them automatically, rather than changing the agent's configuration.
export const AGENT_GENERAL_CONFIG_FIELDS = {
    runner: 'Runner', minProcesses: 'Minimum processes', maxProcesses: 'Maximum processes',
    processCpu: 'Process CPU (units)', processMemory: 'Process memory (MiB)',
    stepLimit: 'Step limit', turnStepLimit: 'Turn step limit', costLimit: 'Cost limit',
    name: 'Name', title: 'Title', description: 'Description', iconName: 'Icon', requiredInputs: 'Required inputs',
};

type ConfigAudit = { fieldName: string; createdAt: Date; oldValue: unknown; newValue: unknown };
const scalar = (value: unknown): string | null => value === null || value === undefined || value === '' ? null : String(value);

export function compareAgentGeneralConfig(current: Record<string, unknown>, entries: ConfigAudit[], older: Date, newer: Date) {
    const fields = Object.entries(AGENT_GENERAL_CONFIG_FIELDS).map(([key, label]) => {
        const history = entries.filter((entry) => entry.fieldName === key);
        const values = [older, newer].map((at) => {
            const before = history.filter((entry) => entry.createdAt <= at);
            return scalar(before.length ? before[before.length - 1].newValue : history.length ? history[0].oldValue : current[key]);
        });
        const changed = values[0] !== values[1] || history.some((entry) => entry.createdAt > older && entry.createdAt <= newer);
        const emptyLabel = key === 'runner' ? 'Installation default'
            : key === 'maxProcesses' ? 'Installation limit'
            : ['processCpu', 'processMemory'].includes(key) ? 'Task definition default' : 'Not set';
        return { key, label, status: changed ? 'changed' : 'matched', left: values[0], right: values[1], emptyLabel };
    });
    return { title: 'General configuration', status: fields.some((field) => field.status === 'changed') ? 'changed' : 'matched', fields };
}
