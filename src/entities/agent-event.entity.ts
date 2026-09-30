import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { AgentSession } from './agent-session.entity';

@Entity({ name: 'ss_agent_events' })
export class AgentEvent extends CommonEntity {

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

  @Column({ type: "varchar", nullable: true })
  reasoning_model_key: string;

  @Column({ type: "varchar", nullable: true })
  fast_model_key: string;

  @ManyToOne(() => AgentSession, { onDelete: "SET NULL", nullable: true })
  @JoinColumn()
  session: AgentSession;

}
