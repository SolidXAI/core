import { Injectable } from "@nestjs/common";
import { DashboardWidgetDataProvider } from "src/decorators/dashboard-widget-data-provider.decorator";
import { IDashboardWidgetDataProvider, IDashboardWidgetDataProviderContext, IDashboardWidgetDataResponseEnvelope } from "src/interfaces";
import { MqMessageRepository } from "src/repository/mq-message.repository";
import { applyMqDashboardFilters, normalizeBucket, toNumber } from "src/services/dashboard-providers/mq-dashboard-provider-utils";

type HeatmapLegendThreshold = {
    label: string;
    color: string;
    lte?: number;
    gte?: number;
    gt?: number;
};

type HeatmapPointDetail = {
    xIndex: number;
    yIndex: number;
    bucket: string;
    queueName: string;
    avgElapsedMillis: number;
    messageCount: number;
    peakElapsedMillis: number;
};

type QueueSlaHeatmapResponse = {
    xCategories: string[];
    yCategories: string[];
    points: [number, number, number][];
    metric: string;
    bucket: string;
    tooltipFields?: string[];
    pointDetails?: HeatmapPointDetail[];
    legendThresholds?: HeatmapLegendThreshold[];
};

const DEFAULT_LEGEND_THRESHOLDS: HeatmapLegendThreshold[] = [
    { label: "0-5s", color: "#22c55e", lte: 5000 },
    { label: "5-15s", color: "#f59e0b", gt: 5000, lte: 15000 },
    { label: "15-30s", color: "#f97316", gt: 15000, lte: 30000 },
    { label: "30s+", color: "#ef4444", gt: 30000 },
];

@DashboardWidgetDataProvider()
@Injectable()
export class MqDashboardQueueSlaHeatmapProvider implements IDashboardWidgetDataProvider {
    constructor(
        private readonly mqMessageRepository: MqMessageRepository,
    ) { }

    name(): string {
        return "MqDashboardQueueSlaHeatmapProvider";
    }

    help(): string {
        return "Returns queue-wise SLA heatmap data using average elapsed millis across time buckets.";
    }

    async getData(
        widgetDefinition: Record<string, any>,
        ctxt: IDashboardWidgetDataProviderContext,
    ): Promise<IDashboardWidgetDataResponseEnvelope<QueueSlaHeatmapResponse>> {
        const bucket = normalizeBucket(ctxt?.providerContext?.bucket);
        const legendThresholds = Array.isArray(ctxt?.providerContext?.legendThresholds) && ctxt.providerContext.legendThresholds.length > 0
            ? ctxt.providerContext.legendThresholds
            : DEFAULT_LEGEND_THRESHOLDS;
        const tooltipFields = Array.isArray(ctxt?.providerContext?.tooltipFields) && ctxt.providerContext.tooltipFields.length > 0
            ? ctxt.providerContext.tooltipFields
            : ["avgElapsedMillis", "messageCount", "peakElapsedMillis"];

        const qb = await this.mqMessageRepository.createSecurityRuleAwareQueryBuilder("mqMessage");
        applyMqDashboardFilters(qb, ctxt.variables ?? {}, { ensureQueueJoin: true });
        qb.andWhere("mqMessage.elapsedMillis IS NOT NULL");

        const bucketExpr = `DATE_TRUNC('${bucket}', mqMessage.createdAt)`;
        const rows = await qb
            .select(bucketExpr, "bucket")
            .addSelect("mqMessageQueue.name", "queueName")
            .addSelect("AVG(mqMessage.elapsedMillis)", "avgElapsedMillis")
            .addSelect("COUNT(mqMessage.id)", "messageCount")
            .addSelect("MAX(mqMessage.elapsedMillis)", "peakElapsedMillis")
            .groupBy(bucketExpr)
            .addGroupBy("mqMessageQueue.name")
            .orderBy("bucket", "ASC")
            .addOrderBy("mqMessageQueue.name", "ASC")
            .getRawMany<{
                bucket: string;
                queueName: string;
                avgElapsedMillis: string | number;
                messageCount: string | number;
                peakElapsedMillis: string | number;
            }>();

        const xCategories = Array.from(
            new Set(
                rows
                    .map((row) => row?.bucket ? new Date(row.bucket).toISOString() : "")
                    .filter((bucketValue) => !!bucketValue)
            )
        ).sort();
        const yCategories = Array.from(
            new Set(rows.map((row) => `${row?.queueName ?? ""}`.trim()).filter((queueName) => !!queueName))
        ).sort((left, right) => left.localeCompare(right));

        const xIndexMap = new Map(xCategories.map((value, index) => [value, index]));
        const yIndexMap = new Map(yCategories.map((value, index) => [value, index]));

        const points: [number, number, number][] = [];
        const pointDetails: HeatmapPointDetail[] = [];

        for (const row of rows) {
            const bucketValue = row?.bucket ? new Date(row.bucket).toISOString() : "";
            const queueName = `${row?.queueName ?? ""}`.trim();
            const xIndex = xIndexMap.get(bucketValue);
            const yIndex = yIndexMap.get(queueName);

            if (xIndex === undefined || yIndex === undefined) {
                continue;
            }

            const avgElapsedMillis = Number(toNumber(row.avgElapsedMillis).toFixed(2));
            const messageCount = toNumber(row.messageCount);
            const peakElapsedMillis = Number(toNumber(row.peakElapsedMillis).toFixed(2));

            points.push([xIndex, yIndex, avgElapsedMillis]);
            pointDetails.push({
                xIndex,
                yIndex,
                bucket: bucketValue,
                queueName,
                avgElapsedMillis,
                messageCount,
                peakElapsedMillis,
            });
        }

        return {
            meta: {
                providerName: this.name(),
                generatedAt: new Date().toISOString(),
                widgetName: ctxt.widgetName,
                durationMs: 0,
            },
            data: {
                xCategories,
                yCategories,
                points,
                metric: "avg_elapsed_millis",
                bucket,
                tooltipFields,
                pointDetails,
                legendThresholds,
            },
        };
    }
}
