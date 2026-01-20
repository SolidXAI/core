import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';


import { MqMessageQueue } from '../entities/mq-message-queue.entity';
import { MqMessageQueueRepository } from 'src/repository/mq-message-queue.repository';

@Injectable()
export class MqMessageQueueService extends CRUDService<MqMessageQueue> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(MqMessageQueue)
    // readonly repo: Repository<MqMessageQueue>,
    readonly repo: MqMessageQueueRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(entityManager, repo, 'mqMessageQueue', 'solid-core', moduleRef);
  }

  async resolveQueue(queueName: string): Promise<MqMessageQueue> {
    let queue = await this.repo.findOne({
      where: {
        name: queueName
      }
    });
    if (!queue) {
      const entity = this.repo.create({ name: queueName });
      queue = await this.repo.save(entity);
    }

    return queue;
  }
}
