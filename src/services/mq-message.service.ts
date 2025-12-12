import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from "src/services/file.service";
import { CrudHelperService } from "src/services/crud-helper.service";
import { MqMessage } from '../entities/mq-message.entity';
import { Logger } from '@nestjs/common';
import { MqMessageRepository } from 'src/repository/mq-message.repository';

@Injectable()
export class MqMessageService extends CRUDService<MqMessage> {
  private readonly logger = new Logger(MqMessageService.name);

  constructor(
    @Inject(forwardRef(() => ModelMetadataService))
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(MqMessage)
    // readonly repo: Repository<MqMessage>,
    readonly repo: MqMessageRepository,
    readonly moduleRef: ModuleRef
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'mqMessage', 'solid-core', moduleRef);
  }

  async lockNextPendingMessage(queueName: string): Promise<MqMessage | null> {
    // this.logger.debug(`Locking next pending message for queue: ${queueName}`);

    return await this.entityManager.transaction(async manager => {
      // Use raw SQL to skip locked rows (FOR UPDATE SKIP LOCKED)
      const rawJob = await manager.query(`
          SELECT ss_mq_message.id
            FROM ss_mq_message
            left join ss_mq_message_queue on ss_mq_message.mq_message_queue_id = ss_mq_message_queue.id
           WHERE ss_mq_message_queue."name" = $1
             AND ss_mq_message.stage = 'pending'
           ORDER BY ss_mq_message.created_at ASC
             FOR UPDATE SKIP LOCKED
           LIMIT 1`,
        [queueName]
      );

      // this.logger.debug(`Raw job fetched: ${JSON.stringify(rawJob)}`);
      if (!rawJob || rawJob.length === 0) {
        // this.logger.debug(`No pending job found for queue: ${queueName}`);
        return null;
      }
      const job = await manager.getRepository(MqMessage).findOne({ where: { id: rawJob[0].id }, relations: ['mqMessageQueue'] });
      if (job) {
        // this.logger.debug(`Locked job id: ${job.id}, queue: ${job.mqMessageQueue.name}, stage: ${job.stage}`);

        job.stage = 'scheduled';
        await manager.save(job);

        return job;
      }

      return null;
    });
  }

  /**
   * Wait until a queue message reaches a terminal status (succeeded/failed).
   *
   * @param messageId string – the external message id you store in `ss_mq_message.messageId`
   * @param opts.timeoutMs total time to wait before giving up (default 60s)
   * @param opts.intervalMs initial poll interval (default 500ms)
   * @param opts.maxIntervalMs cap for exponential backoff (default 2000ms)
   * @param opts.throwOnFailure if true, throws when stage === 'failed' (default false)
   * @param opts.parseJson try JSON.parse on `output` and `error` (default true)
   * @returns resolves with the final MqMessage row when terminal, rejects on timeout (or failure if throwOnFailure)
   */
  async waitForTerminalStatus(
    messageId: string,
    opts?: {
      timeoutMs?: number;
      intervalMs?: number;
      maxIntervalMs?: number;
      throwOnFailure?: boolean;
      parseJson?: boolean;
      logEveryN?: number;
    },
  ): Promise<MqMessage> {
    const {
      timeoutMs = 60_000,
      intervalMs = 500,
      maxIntervalMs = 2_000,
      throwOnFailure = false,
      parseJson = true,
      logEveryN = 10, // log every N polls to avoid noisy logs
    } = opts || {};

    const start = Date.now();
    let attempt = 0;
    let delay = intervalMs;

    // Small helper
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    while (true) {
      attempt++;

      // Fetch minimal columns needed for quick polling
      const rec = await this.repo.findOne({
        where: { messageId },
        select: {
          id: true,
          messageId: true,
          stage: true,
          finishedAt: true,
          elapsedMillis: true,
          output: true,
          error: true,
          input: true,
          // add other fields if you need to return them
        } as any,
        loadEagerRelations: false,
      });

      if (attempt % logEveryN === 0) {
        this.logger.debug(
          `waitForTerminalStatus(${messageId}) poll #${attempt} -> ${rec?.stage ?? 'not_found'}`
        );
      }

      if (!rec) {
        // Not found yet – keep waiting until timeout
      } else if (rec.stage === 'succeeded' || rec.stage === 'failed') {
        // Optionally parse output/error if they contain JSON strings
        if (parseJson) {
          // rec.output = this.safeJsonParse(rec.output);
          rec.output = rec.output;
          // rec.error = this.safeJsonParse(rec.error);
          rec.error = rec.error;
        }

        if (rec.stage === 'failed' && throwOnFailure) {
          throw new Error(
            `Queue message ${messageId} failed` + (rec.error ? `: ${JSON.stringify(rec.error).slice(0, 500)}` : '')
          );
        }
        return rec;
      }

      // Timeout?
      const elapsed = Date.now() - start;
      if (elapsed >= timeoutMs) {
        throw new Error(`Timed out after ${timeoutMs}ms waiting for message ${messageId} to reach terminal status`);
      }

      // Backoff with cap
      await sleep(delay);
      delay = Math.min(Math.floor(delay * 1.5), maxIntervalMs);
    }
  }

  // /**
  //  * Optional wrapper: publish and then wait (if your publisher returns the messageId).
  //  */
  // async publishAndWait<T>(
  //   publishFn: () => Promise<string>, // returns messageId
  //   waitOpts?: Parameters<MqMessageService['waitForTerminalStatus']>[1],
  // ): Promise<MqMessage> {
  //   const messageId = await publishFn();
  //   return this.waitForTerminalStatus(messageId, waitOpts);
  // }

  private safeJsonParse(value: unknown): unknown {
    if (value == null) return value;
    if (typeof value !== 'string') return value;
    const s = value.trim();
    if (!s) return s;
    try {
      return JSON.parse(s);
    } catch {
      return value; // leave as-is if not valid JSON
    }
  }
}
