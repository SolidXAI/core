import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { applyMqDashboardFilters, toNumber } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardQueueWiseAvgElapsedProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardQueueWiseAvgElapsedProvider";
    }

    help(): string {
        return "Returns queue-wise average elapsed millis after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<any>> {
        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {}, { ensureQueueJoin: true });
        qb.andWhere("mqMessage.elapsedMillis IS NOT NULL");

        const rows = await qb
            .select("mqMessageQueue.name", "category")
            .addSelect("AVG(mqMessage.elapsedMillis)", "value")
            .groupBy("mqMessageQueue.name")
            .orderBy("value", "DESC")
            .getRawMany<{ category: string; value: string | number }>();

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                categories: rows.map((r) => r.category),
                series: [{ name: "avg_elapsed_millis", data: rows.map((r) => Number(toNumber(r.value).toFixed(2))) }],
            },
        };
    }
}

