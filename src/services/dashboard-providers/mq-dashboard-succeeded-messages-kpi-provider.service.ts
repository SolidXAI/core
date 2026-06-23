import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { applyMqDashboardFilters } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardSucceededMessagesKpiProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardSucceededMessagesKpiProvider";
    }

    help(): string {
        return "Returns succeeded mq message count after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<{ value: number; label: string }>> {
        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {}, { ignoreStage: true });
        qb.andWhere("mqMessage.stage = :stage", { stage: "succeeded" });

        const value = await qb.getCount();
        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                value,
                label: widgetDefinition?.name ?? "Succeeded",
            },
        };
    }
}

