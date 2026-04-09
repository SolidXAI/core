import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';

@Exclude()
@Entity({ name: 'ss_agent_events', synchronize: false })
export class AgentEvent {
  @Expose()
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Expose()
  @Index()
  @Column({ type: 'varchar', length: 36, name: 'session_id' })
  sessionId: string;

  @Expose()
  @Column({ type: 'integer', name: 'turn_number' })
  turnNumber: number;

  @Expose()
  @Column({ type: 'integer', nullable: true, name: 'step_number' })
  stepNumber: number;

  @Expose()
  @Index()
  @Column({ type: 'varchar', length: 64, name: 'event_type' })
  eventType: string;

  @Expose()
  @Column({ type: 'text', nullable: true, name: 'event_data' })
  eventData: string;

  @Expose()
  @Column({ type: 'text', nullable: true, name: 'content' })
  content: string;

  @Expose()
  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true, name: 'tool_name' })
  toolName: string;

  @Expose()
  @Column({ type: 'text', nullable: true, name: 'tool_arguments' })
  toolArguments: string;

  @Expose()
  @Column({ type: 'text', nullable: true, name: 'tool_output' })
  toolOutput: string;

  @Expose()
  @Column({ type: 'integer', nullable: true, name: 'tool_returncode' })
  toolReturncode: number;

  @Expose()
  @Column({ type: 'double precision', nullable: true, name: 'duration_ms' })
  durationMs: number;

  @Expose()
  @Column({ type: 'double precision', nullable: true, name: 'cost' })
  cost: number;

  @Expose()
  @Column({ type: 'integer', nullable: true, name: 'input_tokens' })
  inputTokens: number;

  @Expose()
  @Column({ type: 'integer', nullable: true, name: 'output_tokens' })
  outputTokens: number;

  @Expose()
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'model_used' })
  modelUsed: string;

  @Expose()
  @Column({ type: 'timestamp without time zone', name: 'created_at' })
  createdAt: Date;

  // The following properties satisfy CRUDService<T extends CommonEntity> structural typing
  // They are not mapped to DB columns (synchronize: false ensures no schema changes)
  updatedAt: Date;
  deletedAt: Date;
  deletedTracker: string;
  publishedAt: Date;
  localeName: string;
  defaultEntityLocaleId: number;
  createdBy: number;
  updatedBy: number;
}
