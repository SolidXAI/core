import { Injectable } from "@nestjs/common";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { MqMessageQueueRepository } from "src/repository/mq-message-queue.repository";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "src/interfaces";

@SelectionProvider()
@Injectable()
export class MqDashboardQueueNameVariableOptionsProvider implements ISelectionProvider<ISelectionProviderContext> {
    constructor(
        private readonly mqMessageQueueRepository: MqMessageQueueRepository,
    ) { }

    name(): string {
        return "MqDashboardQueueNameVariableOptionsProvider";
    }

    help(): string {
        return "Dynamic options provider for dashboard queueName variable.";
    }

    async value(optionValue: string): Promise<ISelectionProviderValues | null> {
        if (!optionValue) return null;
        const queue = await this.mqMessageQueueRepository.findOne({
            where: { name: optionValue },
        });
        if (!queue?.name) return null;
        return { label: queue.name, value: queue.name };
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const qb = await this.mqMessageQueueRepository.createSecurityRuleAwareQueryBuilder("mqMessageQueue");
        const limit = Math.min(Math.max(ctxt?.limit ?? 25, 1), 200);
        const offset = Math.max(ctxt?.offset ?? 0, 0);

        if (query) {
            qb.andWhere("mqMessageQueue.name ILIKE :query", { query: `%${query}%` });
        }

        const records = await qb
            .select(["mqMessageQueue.name"])
            .orderBy("mqMessageQueue.name", "ASC")
            .take(limit)
            .skip(offset)
            .getMany();

        return records
            .filter((r) => !!r?.name)
            .map((r) => ({ label: r.name, value: r.name }));
    }
}

