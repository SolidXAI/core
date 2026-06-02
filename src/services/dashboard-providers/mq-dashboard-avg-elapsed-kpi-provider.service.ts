import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { applyMqDashboardFilters, toNumber } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardAvgElapsedKpiProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardAvgElapsedKpiProvider";
    }

    help(): string {
        return "Returns average elapsed millis after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<{ value: number; label: string }>> {
        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {});
        qb.andWhere("mqMessage.elapsedMillis IS NOT NULL");

        const raw = await qb
            .select("AVG(mqMessage.elapsedMillis)", "avgElapsed")
            .getRawOne<{ avgElapsed?: string | number }>();

        const value = Number(toNumber(raw?.avgElapsed, 0).toFixed(2));
        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                value,
                label: widgetDefinition?.name ?? "Avg Elapsed (ms)",
            },
        };
    }
}

