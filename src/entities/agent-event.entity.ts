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

  @Column({ nullable: true, ...getColumnType('longText') })
  eventData: string;

  @Column({ nullable: true, ...getColumnType('longText') })
  context: string;

  @Column({ nullable: true, ...getColumnType('longText') })
  content: string;

  @Index()
  @Column({ nullable: true })
  toolName: string;

  @Column({ nullable: true, ...getColumnType('longText') })
  toolArguments: string;

  @Column({ nullable: true, ...getColumnType('longText') })
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
  reasoningModelKey: string;

  @Column({ type: "varchar", nullable: true })
  fastModelKey: string;

  @ManyToOne(() => AgentSession, { onDelete: "SET NULL", nullable: true })
  @JoinColumn()
  session: AgentSession;

}
