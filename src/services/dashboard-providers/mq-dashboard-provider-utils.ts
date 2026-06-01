import { MqMessage } from "src/entities/mq-message.entity";
import { SelectQueryBuilder } from "typeorm";

export const MQ_INFLIGHT_STAGES = ['pending', 'scheduled', 'started', 'retry', 'retrying'];

export interface MqDashboardVariables {
    date?: any;
    queueName?: string | string[];
    stage?: string | string[];
    messageBroker?: string | string[];
}

export interface ApplyMqDashboardFiltersOptions {
    ignoreStage?: boolean;
    ensureQueueJoin?: boolean;
}

export function applyMqDashboardFilters(
    qb: SelectQueryBuilder<MqMessage>,
    variables: MqDashboardVariables = {},
    options: ApplyMqDashboardFiltersOptions = {},
): SelectQueryBuilder<MqMessage> {
    applyDateFilter(qb, variables.date);
    applyStringOrArrayFilter(qb, 'mqMessage.messageBroker', variables.messageBroker, 'messageBroker');

    if (!options.ignoreStage) {
        applyStringOrArrayFilter(qb, 'mqMessage.stage', variables.stage, 'stage');
    }

    if (
        options.ensureQueueJoin ||
        (variables.queueName !== undefined && variables.queueName !== null && variables.queueName !== '')
    ) {
        qb.leftJoin('mqMessage.mqMessageQueue', 'mqMessageQueue');
    }

    if (variables.queueName !== undefined && variables.queueName !== null && variables.queueName !== '') {
        applyStringOrArrayFilter(qb, 'mqMessageQueue.name', variables.queueName, 'queueName');
    }

    return qb;
}

export function normalizeBucket(value: string | undefined): 'hour' | 'day' | 'week' | 'month' {
    const v = `${value ?? ''}`.toLowerCase();
    if (v === 'hour' || v === 'day' || v === 'week' || v === 'month') {
        return v;
    }
    return 'hour';
}

export function toNumber(value: any, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}


function applyDateFilter(qb: SelectQueryBuilder<MqMessage>, dateVariable: any): void {
    const range = resolveDateRange(dateVariable);
    if (range.from) {
        qb.andWhere('mqMessage.createdAt >= :dashboardDateFrom', { dashboardDateFrom: range.from.toISOString() });
    }
    if (range.to) {
        qb.andWhere('mqMessage.createdAt <= :dashboardDateTo', { dashboardDateTo: range.to.toISOString() });
    }
}

function applyStringOrArrayFilter(
    qb: SelectQueryBuilder<MqMessage>,
    qualifiedColumn: string,
    value: string | string[] | undefined,
    paramKey: string,
) {
    if (value === undefined || value === null || value === '') {
        return;
    }

    const values = Array.isArray(value) ? value.filter((v) => !!v) : [value];
    if (values.length === 0) {
        return;
    }

    if (values.length === 1) {
        qb.andWhere(`${qualifiedColumn} = :${paramKey}`, { [paramKey]: values[0] });
        return;
    }

    qb.andWhere(`${qualifiedColumn} IN (:...${paramKey})`, { [paramKey]: values });
}

function resolveDateRange(dateVariable: any): { from?: Date; to?: Date } {
    if (!dateVariable) return {};

    if (Array.isArray(dateVariable) && dateVariable.length >= 2) {
        return {
            from: parseDate(dateVariable[0]),
            to: parseDate(dateVariable[1]),
        };
    }

    if (typeof dateVariable === 'object') {
        const presetRange = resolvePresetRange(dateVariable.preset);
        const from = parseDate(dateVariable.from ?? dateVariable.start ?? dateVariable.startDate) ?? presetRange.from;
        const to = parseDate(dateVariable.to ?? dateVariable.end ?? dateVariable.endDate) ?? presetRange.to;
        return { from, to };
    }

    if (typeof dateVariable === 'string') {
        const presetRange = resolvePresetRange(dateVariable);
        if (presetRange.from || presetRange.to) {
            return presetRange;
        }
        const parsed = parseDate(dateVariable);
        if (!parsed) return {};
        return { from: parsed, to: parsed };
    }

    return {};
}

function parseDate(value: any): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d;
}

function resolvePresetRange(preset: string | undefined): { from?: Date; to?: Date } {
    if (!preset) return {};

    const now = new Date();
    const to = new Date(now);
    switch (preset) {
        case 'today': {
            const from = new Date(now);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
        case 'yesterday': {
            const from = new Date(now);
            from.setDate(from.getDate() - 1);
            from.setHours(0, 0, 0, 0);
            const end = new Date(from);
            end.setHours(23, 59, 59, 999);
            return { from, to: end };
        }
        case 'last_24_hours': {
            const from = new Date(now);
            from.setHours(from.getHours() - 24);
            return { from, to };
        }
        case 'last_7_days': {
            const from = new Date(now);
            from.setDate(from.getDate() - 7);
            return { from, to };
        }
        case 'last_30_days': {
            const from = new Date(now);
            from.setDate(from.getDate() - 30);
            return { from, to };
        }
        default:
            return {};
    }
}
