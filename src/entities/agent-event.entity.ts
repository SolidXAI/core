import { Column, Entity, Index } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity({ name: 'ss_agent_events' })
export class AgentEvent extends CommonEntity {
  @Index()
  @Column({ })
  sessionId: string;

  @Column({ })
  turnNumber: number;

  @Column({ nullable: true })
  stepNumber: number;

  @Index()
  @Column({ })
  eventType: string;

  @Column({ type: "simple-json", nullable: true, ...getColumnType('simpleJsonLargeText') })
  eventData: any;

  @Column({ nullable: true, ...getColumnType('longText') })
  content: string;

  @Index()
  @Column({ nullable: true })
  toolName: string;

  @Column({ type: "simple-json", nullable: true, ...getColumnType('simpleJsonLargeText') })
  toolArguments: string;

  @Column({ type: "simple-json", nullable: true, ...getColumnType('simpleJsonLargeText') })
  toolOutput: string;

  @Column({ nullable: true })
  toolReturncode: number;

  @Column({ nullable: true, ...getColumnType('decimal') })
  durationMs: number;

  @Column({ nullable: true, ...getColumnType('decimal') })
  cost: number;

  @Column({ nullable: true })
  inputTokens: number;

  @Column({ nullable: true })
  outputTokens: number;

  @Column({ nullable: true })
  modelUsed: string;
}
