// src/common/poller/poller.service.ts
import {
    Injectable,
    Logger,
    OnModuleDestroy,
    BeforeApplicationShutdown,
} from '@nestjs/common';

export interface PollOptions {
    /** Wait after a successful iteration */
    baseDelayMs?: number;            // default 1000
    /** Maximum delay after repeated failures */
    maxDelayMs?: number;             // default 30000
    /** Per-iteration timeout guard */
    timeoutPerIterationMs?: number;  // default 60000
    /** Add jitter to spread load */
    jitter?: boolean;                // default true
}

type ProcessNextFn = (queueName: string) => Promise<unknown>;

interface PollerState {
    queueName: string;
    processNext: ProcessNextFn;
    opts: Required<PollOptions>;
    inFlight: boolean;
    stopped: boolean;
    backoff: number;
    nextTimer?: NodeJS.Timeout;
}

@Injectable()
export class PollerService implements OnModuleDestroy, BeforeApplicationShutdown {
    private readonly logger = new Logger(PollerService.name);
    private readonly pollers = new Map<string, PollerState>();

    start(queueName: string, processNext: ProcessNextFn, options: PollOptions = {}): void {
        if (this.pollers.has(queueName)) {
            this.logger.warn(`Poller "${queueName}" already started; ignoring.`);
            return;
        }

        const opts: Required<PollOptions> = {
            baseDelayMs: options.baseDelayMs ?? 1000,
            maxDelayMs: options.maxDelayMs ?? 30_000,
            timeoutPerIterationMs: options.timeoutPerIterationMs ?? 60_000,
            jitter: options.jitter ?? true,
        };

        const state: PollerState = {
            queueName,
            processNext,
            opts,
            inFlight: false,
            stopped: false,
            backoff: opts.baseDelayMs,
            nextTimer: undefined,
        };

        this.pollers.set(queueName, state);
        // kick off on next tick
        setImmediate(() => this.poll(state).catch(() => { }));
        this.logger.log(`Started poller "${queueName}"`);
    }

    stop(queueName: string): void {
        const state = this.pollers.get(queueName);
        if (!state) return;

        state.stopped = true;
        if (state.nextTimer) {
            clearTimeout(state.nextTimer);
            state.nextTimer = undefined;
        }
        this.pollers.delete(queueName);
        this.logger.log(`Stopped poller "${queueName}"`);
    }

    stopAll(): void {
        for (const name of Array.from(this.pollers.keys())) {
            this.stop(name);
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.stopAll();
    }

    async beforeApplicationShutdown(): Promise<void> {
        this.stopAll();
    }

    // ---- internals ----

    private async poll(state: PollerState): Promise<void> {
        if (state.stopped || state.inFlight) return;
        state.inFlight = true;

        try {
            await this.withTimeout(
                state.processNext(state.queueName),
                state.opts.timeoutPerIterationMs,
            );

            // success: reset backoff and schedule next run after base delay
            state.backoff = state.opts.baseDelayMs;
            // this.logger.debug(`[${state.queueName}] iteration completed`);
            this.schedule(state, state.opts.baseDelayMs);
        } catch (err: unknown) {
            const msg = this.errorToString(err);
            this.logger.error(`[${state.queueName}] iteration failed: ${msg}`);

            // failure: schedule with backoff + optional jitter, then increase backoff
            const wait = this.computeWait(state.backoff, state.opts);
            state.backoff = Math.min(state.backoff * 2, state.opts.maxDelayMs);
            this.schedule(state, wait);
        } finally {
            state.inFlight = false;
        }
    }

    private schedule(state: PollerState, delayMs: number) {
        if (state.stopped) return;
        if (state.nextTimer) clearTimeout(state.nextTimer);

        state.nextTimer = setTimeout(() => {
            // clear reference before calling poll to avoid re-entrancy confusion
            state.nextTimer = undefined;
            this.poll(state).catch(() => { });
        }, delayMs);
    }

    private computeWait(currentBackoff: number, opts: Required<PollOptions>): number {
        if (!opts.jitter) return currentBackoff;
        // Full jitter: random in [250ms, currentBackoff * 2], clamped to maxDelayMs
        const doubled = Math.min(currentBackoff * 2, opts.maxDelayMs);
        const jittered = Math.floor(Math.random() * doubled);
        return Math.max(250, jittered);
    }

    private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
        let timer: NodeJS.Timeout | undefined;
        try {
            return await Promise.race<T>([
                p,
                new Promise<never>((_, rej) => {
                    timer = setTimeout(() => rej(new Error(`Iteration timed out after ${ms} ms`)), ms);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private errorToString(err: unknown): string {
        if (err instanceof Error) return err.stack ?? err.message;
        try {
            return JSON.stringify(err);
        } catch {
            return String(err);
        }
    }
}