import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { QueueMessage } from 'src/interfaces/mq';
import testRunQueueConfig from './test-run-queue-options-database';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { PollerService } from 'src/services/poller.service';
import { runFromMetadata } from '../../testing/runner/run-from-metadata';
import {
  LifecycleWebhookReporter,
  WebhookPostFn,
} from '../../testing/reporter/lifecycle-webhook-reporter';
import { TestRunJobPayload } from '../../dtos/test-run-request.dto';

/**
 * Executes a queued test run on the worker tier (QUEUES_SERVICE_ROLE=subscriber).
 * Runs the inline scenarios via {@link runFromMetadata} with a
 * {@link LifecycleWebhookReporter} that streams run.start → scenario.* → run.end to
 * the caller's webhookUrl. A failing TEST is NOT a failing JOB: failures are reported
 * over the webhook (run.end ok:false) and the job still completes, so the queue does
 * not retry a deterministically-failing test run.
 */
@Injectable()
export class TestRunQueueSubscriberDatabase extends DatabaseSubscriber<TestRunJobPayload> {
    private readonly testRunLogger = new Logger(TestRunQueueSubscriberDatabase.name);

    constructor(
        readonly mqMessageService: MqMessageService,
        readonly mqMessageQueueService: MqMessageQueueService,
        readonly poller: PollerService,
        private readonly httpService: HttpService,
    ) {
        super(mqMessageService, mqMessageQueueService, poller);
    }

    options(): QueuesModuleOptions {
        return {
            ...testRunQueueConfig
        }
    }

    async subscribe(message: QueueMessage<TestRunJobPayload>) {
        const p = message.payload;
        this.testRunLogger.debug(`Starting test run ${p.runId} (externalRunId=${p.externalRunId})`);

        const post: WebhookPostFn = async (url, body, opts) => {
            const res = await this.httpService.axiosRef.post(url, body, {
                headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
                timeout: opts.timeoutMs ?? 10_000,
                validateStatus: () => true,
            });
            return { ok: res.status >= 200 && res.status < 300, status: res.status };
        };

        const reporter = new LifecycleWebhookReporter({
            webhookUrl: p.webhookUrl,
            runName: p.externalRunId ?? p.runId,
            externalRunId: p.externalRunId,
            runId: p.runId,
            post,
        });

        let exitCode = 0;
        try {
            await runFromMetadata({
                scenarios: p.scenarios,
                data: p.data,
                includeTags: p.includeTags,
                scenarioIds: p.scenarioIds,
                skipScenarioIds: p.skipScenarioIds,
                reporter,
                env: p.variables,
                api: { baseUrl: p.baseUrl },
                ui: { baseUrl: p.uiBaseUrl, headless: p.headless ?? true, capture: p.capture },
                options: { printApiLogs: p.printApiLogs ?? true },
                externalRunId: p.externalRunId,
            });
        } catch (err: any) {
            // A failed scenario is surfaced via the run.end webhook, not as a job failure.
            exitCode = 1;
            this.testRunLogger.warn(`Test run ${p.runId} completed with failures: ${err?.message ?? err}`);
        } finally {
            await reporter.flushPending(exitCode);
        }

        return { runId: p.runId, exitCode };
    }
}
