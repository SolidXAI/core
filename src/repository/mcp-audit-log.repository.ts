import { Injectable } from '@nestjs/common';
import { McpAuditLog } from 'src/entities/mcp-audit-log.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class McpAuditLogRepository extends SolidBaseRepository<McpAuditLog> {
  constructor(
    readonly dataSource: DataSource,
    readonly requestContextService: RequestContextService,
    readonly securityRuleRepository: SecurityRuleRepository,
  ) {
    super(McpAuditLog, dataSource, requestContextService, securityRuleRepository);
  }
}
