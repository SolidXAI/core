import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import {
    applyMqDashboardFilters,
    buildMqDashboardBucketExpression,
    normalizeBucket,
    normalizeMqDashboardBucketValue,
    toNumber,
} from "src/services/dashboard-providers/mq-dashboard-provider-utils";

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardMessagesOverTimeProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardMessagesOverTimeProvider";
    }

    help(): string {
        return "Returns time-series message counts by stage (and total) after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<any>> {
        const bucket = normalizeBucket(ctxt?.providerContext?.bucket);
        const requestedSeries: string[] = Array.isArray(ctxt?.providerContext?.series) && ctxt.providerContext.series.length > 0
            ? ctxt.providerContext.series
            : ["total", "succeeded", "failed", "retrying"];

        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {});

        const bucketExpr = buildMqDashboardBucketExpression(qb, bucket, "mqMessage.createdAt");
        const rows = await qb
            .select(bucketExpr, "bucket")
            .addSelect("mqMessage.stage", "stage")
            .addSelect("COUNT(mqMessage.id)", "count")
            .groupBy(bucketExpr)
            .addGroupBy("mqMessage.stage")
            .orderBy("bucket", "ASC")
            .getRawMany<{ bucket: string; stage: string; count: string | number }>();

        const bucketToStageMap = new Map<string, Record<string, number>>();
        for (const row of rows) {
            const key = normalizeMqDashboardBucketValue(row.bucket);
            const entry = bucketToStageMap.get(key) ?? {};
            entry[row.stage] = (entry[row.stage] ?? 0) + toNumber(row.count, 0);
            bucketToStageMap.set(key, entry);
        }

        const categories = Array.from(bucketToStageMap.keys()).sort();
        const series = requestedSeries.map((seriesName) => {
            const data = categories.map((category) => {
                const stageMap = bucketToStageMap.get(category) ?? {};
                if (seriesName === "total") {
                    return Object.values(stageMap).reduce((sum, value) => sum + value, 0);
                }
                return stageMap[seriesName] ?? 0;
            });
            return { name: seriesName, data };
        });

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                categories,
                series,
                bucket,
            },
        };
    }
}
