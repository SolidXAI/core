import { Injectable } from '@nestjs/common';
import { MqMessage } from '../entities/mq-message.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MqMessageRepository extends SolidBaseRepository<MqMessage> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(MqMessage, dataSource, requestContextService, securityRuleRepository);
    }
}