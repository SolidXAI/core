import { Injectable } from '@nestjs/common';
import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { MqMessageQueue } from '../entities/mq-message-queue.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MqMessageQueueRepository extends SolidBaseRepository<MqMessageQueue> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(MqMessageQueue, dataSource, requestContextService, securityRuleRepository);
    }
}