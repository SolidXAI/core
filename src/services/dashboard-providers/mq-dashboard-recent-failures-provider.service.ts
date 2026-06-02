import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { applyMqDashboardFilters } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardRecentFailuresProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardRecentFailuresProvider";
    }

    help(): string {
        return "Returns recent failed mq messages in a tabular payload after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<any>> {
        const limit = Math.min(Math.max(Number(ctxt?.providerContext?.limit ?? 25), 1), 200);
        const errorMaxLength = Math.max(Number(ctxt?.providerContext?.errorMaxLength ?? 160), 0);

        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {}, { ignoreStage: true, ensureQueueJoin: true });
        qb.andWhere("mqMessage.stage = :failedStage", { failedStage: "failed" });

        const rows = await qb
            .select([
                "mqMessage.id AS id",
                "mqMessage.messageId AS messageId",
                "mqMessageQueue.name AS queueName",
                "mqMessage.stage AS stage",
                "mqMessage.retryCount AS retryCount",
                "mqMessage.elapsedMillis AS elapsedMillis",
                "mqMessage.startedAt AS startedAt",
                "mqMessage.finishedAt AS finishedAt",
                "mqMessage.error AS error",
                "mqMessage.createdAt AS createdAt",
            ])
            .orderBy("mqMessage.createdAt", "DESC")
            .take(limit)
            .getRawMany<Record<string, any>>();

        const columns = [
            "id",
            "messageId",
            "queueName",
            "stage",
            "retryCount",
            "elapsedMillis",
            "startedAt",
            "finishedAt",
            "error",
            "createdAt",
        ];

        const records = rows.map((row) => ({
            id: row.id ?? null,
            messageId: row.messageId ?? row.messageid ?? null,
            queueName: row.queueName ?? row.queuename ?? null,
            stage: row.stage ?? null,
            retryCount: row.retryCount ?? row.retrycount ?? null,
            elapsedMillis: row.elapsedMillis ?? row.elapsedmillis ?? null,
            startedAt: row.startedAt ?? row.startedat ?? null,
            finishedAt: row.finishedAt ?? row.finishedat ?? null,
            error: truncateString(row.error ?? null, errorMaxLength),
            createdAt: row.createdAt ?? row.createdat ?? null,
        }));

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                columns,
                records,
            },
        };
    }
}

function truncateString(value: any, maxLength: number): any {
    if (!value || typeof value !== 'string') return value;
    if (maxLength <= 0 || value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
}
