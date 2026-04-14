import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Expose, Exclude } from 'class-transformer';

@Exclude()
@Entity({ name: 'ss_agent_sessions', synchronize: false })
export class AgentSession {
  @Expose()
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  @Expose()
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36, name: 'session_id' })
  sessionId: string;

  @Expose()
  @Index()
  @Column({ type: 'integer', nullable: true, name: 'user_id' })
  userId: number;

  @Expose()
  @Column({ type: 'text', nullable: true, name: 'project_root' })
  projectRoot: string;

  @Expose()
  @Column({ type: 'varchar', length: 255, name: 'model_name' })
  modelName: string;

  @Expose()
  @Index()
  @Column({ type: 'varchar', length: 32, name: 'status' })
  status: string;

  @Expose()
  @Column({ type: 'decimal', name: 'total_cost', default: 0, precision: 18, scale: 6 })
  totalCost: number;

  @Expose()
  @Column({ type: 'integer', name: 'total_steps', default: 0 })
  totalSteps: number;

  @Expose()
  @Column({ type: 'integer', name: 'total_input_tokens', default: 0 })
  totalInputTokens: number;

  @Expose()
  @Column({ type: 'integer', name: 'total_output_tokens', default: 0 })
  totalOutputTokens: number;

  @Expose()
  @Column({ type: 'text', nullable: true, name: 'summary' })
  summary: string;

  @Expose()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Expose()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // The following properties satisfy CRUDService<T extends CommonEntity> structural typing
  // They are not mapped to DB columns (synchronize: false ensures no schema changes)
  deletedAt: Date;
  deletedTracker: string;
  publishedAt: Date;
  localeName: string;
  defaultEntityLocaleId: number;
  createdBy: number;
  updatedBy: number;
}
