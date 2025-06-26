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
    @InjectRepository(MqMessage)
    readonly repo: Repository<MqMessage>,
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

}
