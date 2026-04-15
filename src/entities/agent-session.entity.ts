import { Column, Entity, Index } from 'typeorm';
import { CommonEntity } from 'src/entities/common.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity({ name: 'ss_agent_sessions', synchronize: false })
export class AgentSession extends CommonEntity {
  @Index({ unique: true })
  @Column({ })
  sessionId: string;

  @Index()
  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true, ...getColumnType('longText') })
  projectRoot: string;

  @Column({ })
  modelName: string;

  @Index()
  @Column({ })
  status: string;

  @Column({ default: 0, ...getColumnType('decimal') })
  totalCost: number;

  @Column({ default: 0 })
  totalSteps: number;

  @Column({ default: 0 })
  totalInputTokens: number;

  @Column({ default: 0 })
  totalOutputTokens: number;

  @Column({ nullable: true, ...getColumnType('longText') })
  summary: string;
}
