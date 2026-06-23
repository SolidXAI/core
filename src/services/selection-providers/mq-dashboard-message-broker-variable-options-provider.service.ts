import { Injectable } from "@nestjs/common";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "src/interfaces";
import { applyCaseInsensitiveContainsFilter } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@SelectionProvider()
@Injectable()
export class MqDashboardMessageBrokerVariableOptionsProvider implements ISelectionProvider<ISelectionProviderContext> {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardMessageBrokerVariableOptionsProvider";
    }

    help(): string {
        return "Dynamic options provider for dashboard messageBroker variable.";
    }

    async value(optionValue: string): Promise<ISelectionProviderValues | null> {
        if (!optionValue) return null;
        return { label: optionValue, value: optionValue };
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        const limit = Math.min(Math.max(ctxt?.limit ?? 25, 1), 200);
        const offset = Math.max(ctxt?.offset ?? 0, 0);

        qb.select("DISTINCT mqMessage.messageBroker", "value")
            .where("mqMessage.messageBroker IS NOT NULL");

        applyCaseInsensitiveContainsFilter(qb, "mqMessage.messageBroker", query, "query");

        const rows = await qb
            .orderBy("value", "ASC")
            .take(limit)
            .skip(offset)
            .getRawMany<{ value: string }>();

        return rows
            .filter((r) => !!r?.value)
            .map((r) => ({
                label: r.value,
                value: r.value,
            }));
    }
}
