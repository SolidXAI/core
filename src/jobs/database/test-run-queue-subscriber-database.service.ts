import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { QueueMessage } from 'src/interfaces/mq';
import testRunQueueConfig from './test-run-queue-options-database';
import { MqMessageService } from '../../services/mq-message.service';
import { MqMessageQueueService } from '../../services/mq-message-queue.service';
import { QueuesModuleOptions } from "../../interfaces";
import { DatabaseSubscriber } from 'src/services/queues/database-subscriber.service';
import { PollerService } from 'src/services/poller.service';
import { runFromMetadata } from '../../testing/runner/run-from-metadata';
import { readScenariosFile } from '../../testing/runner/read-scenarios-file';
import {
  LifecycleWebhookReporter,
  WebhookPostFn,
} from '../../testing/reporter/lifecycle-webhook-reporter';
import { FileServiceArtifactSink } from '../../testing/reporter/file-service-artifact-sink';
import { FILE_SERVICE, IFileService } from '../../services/file/file-service.interface';
import { TestRunJobPayload } from '../../dtos/test-run-request.dto';
import { WorkflowSecretService } from '../../services/workflow-secret.service';

/**
 * Executes a queued test run on the worker tier (QUEUES_SERVICE_ROLE=subscriber).
 * Resolves scenarios from `scenariosPath` (read from disk here, at execution time —
 * the worker shares the filesystem with the caller) or from inline `scenarios`, then
 * runs them via {@link runFromMetadata} with a {@link LifecycleWebhookReporter} that
 * streams run.start → scenario.* → run.end to the caller's webhookUrl. A failing TEST
 * is NOT a failing JOB: failures (including an unreadable scenario file) are reported
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
        @Inject(FILE_SERVICE) private readonly fileService: IFileService,
        private readonly workflowSecretService: WorkflowSecretService,
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

        // Persist binary artifacts (screenshots, whole-run video) to shared storage via the
        // core FILE_SERVICE (disk by default, S3 when DEFAULT_FILE_SERVICE=s3) instead of
        // shipping them inline / storing blobs in the DB.
        const artifactSink = new FileServiceArtifactSink(this.fileService, { prefix: 'testing-hub' });

        const reporter = new LifecycleWebhookReporter({
            webhookUrl: p.webhookUrl,
            runName: p.externalRunId ?? p.runId,
            externalRunId: p.externalRunId,
            runId: p.runId,
            post,
            artifactSink,
        });

        let scenarios = p.scenarios;
        let data = p.data;
        if (p.scenariosPath) {
            const read = readScenariosFile(p.scenariosPath);
            if (!read.ok) {
                const reason = `Scenario file unreadable: ${p.scenariosPath} (${read.error})`;
                this.testRunLogger.warn(`Test run ${p.runId} — ${reason}`);
                reporter.onRunStart({ total: 0, startedAt: new Date().toISOString(), scenarioIds: [] });
                await reporter.flushPending(1, reason);
                return { runId: p.runId, exitCode: 1 };
            }
            scenarios = read.scenarios;
            data = read.data ?? data;
            this.testRunLogger.debug(`Test run ${p.runId} loaded ${scenarios.length} scenario(s) from ${p.scenariosPath}`);
        }

        let exitCode = 0;
        try {
            await runFromMetadata({
                scenarios,
                data,
                includeTags: p.includeTags,
                scenarioIds: p.scenarioIds,
                skipScenarioIds: p.skipScenarioIds,
                reporter,
                env: p.variables,
                api: { baseUrl: p.baseUrl },
                ui: { baseUrl: p.uiBaseUrl, headless: p.headless ?? true, capture: p.capture, recordVideo: p.recordVideo ?? true },
                options: { printApiLogs: p.printApiLogs ?? true },
                externalRunId: p.externalRunId,
                resolveSecrets: (keys) => this.workflowSecretService.resolveAvailable(keys),
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
