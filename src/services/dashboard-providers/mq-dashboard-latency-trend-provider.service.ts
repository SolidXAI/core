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
export class MqDashboardLatencyTrendProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardLatencyTrendProvider";
    }

    help(): string {
        return "Returns average elapsed millis trend over time buckets after applying dashboard variables.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<any>> {
        const bucket = normalizeBucket(ctxt?.providerContext?.bucket);

        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {});
        qb.andWhere("mqMessage.elapsedMillis IS NOT NULL");

        const bucketExpr = buildMqDashboardBucketExpression(qb, bucket, "mqMessage.createdAt");
        const rows = await qb
            .select(bucketExpr, "bucket")
            .addSelect("AVG(mqMessage.elapsedMillis)", "value")
            .groupBy(bucketExpr)
            .orderBy("bucket", "ASC")
            .getRawMany<{ bucket: string; value: string | number }>();

        const categories = rows.map((r) => normalizeMqDashboardBucketValue(r.bucket));
        const values = rows.map((r) => Number(toNumber(r.value).toFixed(2)));

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                categories,
                series: [{ name: "avg_elapsed_millis", data: values }],
                bucket,
            },
        };
    }
}
