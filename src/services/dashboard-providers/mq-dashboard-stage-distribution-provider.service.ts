import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { applyMqDashboardFilters, toNumber } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardStageDistributionProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardStageDistributionProvider";
    }

    help(): string {
        return "Returns grouped count by stage after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<any>> {
        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {});

        const rows = await qb
            .select("mqMessage.stage", "name")
            .addSelect("COUNT(mqMessage.id)", "value")
            .groupBy("mqMessage.stage")
            .orderBy("value", "DESC")
            .getRawMany<{ name: string; value: string | number }>();

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                items: rows.map((r) => ({ name: r.name, value: toNumber(r.value) })),
            },
        };
    }
}

