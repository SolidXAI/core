import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { applyMqDashboardFilters } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardSuccessRateKpiProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardSuccessRateKpiProvider";
    }

    help(): string {
        return "Returns success rate percentage after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<{ value: number; label: string; numerator: number; denominator: number }>> {
        const totalQb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(totalQb, ctxt.variables ?? {}, { ignoreStage: true });

        const successQb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(successQb, ctxt.variables ?? {}, { ignoreStage: true });
        successQb.andWhere("mqMessage.stage = :stage", { stage: "succeeded" });

        const [total, succeeded] = await Promise.all([totalQb.getCount(), successQb.getCount()]);
        const value = total > 0 ? Number(((succeeded / total) * 100).toFixed(2)) : 0;

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                value,
                label: widgetDefinition?.name ?? "Success Rate",
                numerator: succeeded,
                denominator: total,
            },
            uiHints: {
                suffix: "%",
            },
        };
    }
}

