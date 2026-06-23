import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { McpAuditLog } from 'src/entities/mcp-audit-log.entity';
import { McpAuditLogRepository } from 'src/repository/mcp-audit-log.repository';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';

@Injectable()
export class McpAuditLogService extends CRUDService<McpAuditLog> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: McpAuditLogRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'mcpAuditLog', 'solid-core', moduleRef);
  }
}
