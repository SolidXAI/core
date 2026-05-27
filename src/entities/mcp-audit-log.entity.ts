import { Column, Entity, Index } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity({ name: 'ss_mcp_audit_log' })
export class McpAuditLog extends CommonEntity {
  @Index()
  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true })
  apiKeyId: number;

  @Column({ nullable: true, length: 128 })
  username: string;

  @Column({ length: 32 })
  transport: string;

  @Index()
  @Column({ nullable: true, length: 64 })
  mcpSessionId: string;

  @Column({ nullable: true, length: 64 })
  clientAddr: string;

  @Index()
  @Column({ length: 64 })
  method: string;

  @Column({ nullable: true, length: 64 })
  requestId: string;

  @Index()
  @Column({ nullable: true, length: 128 })
  toolName: string;

  @Column({ nullable: true, ...getColumnType('longText') })
  requestParams: string;

  @Column({ length: 16 })
  status: string;

  @Column({ nullable: true, ...getColumnType('longText') })
  responseResult: string;

  @Column({ nullable: true })
  errorCode: number;

  @Column({ nullable: true, ...getColumnType('longText') })
  errorMessage: string;

  @Column({ nullable: true, ...getColumnType('decimal') })
  durationMs: number;
}
