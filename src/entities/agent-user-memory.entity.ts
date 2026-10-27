import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { AgentRegistry } from './agent-registry.entity';
import { AgentSession } from './agent-session.entity';

@Entity('ss_agent_user_memory')
export class AgentUserMemory extends CommonEntity {
    @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn()
    user: User;

    @ManyToOne(() => AgentRegistry, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn()
    agent: AgentRegistry;

    @Column({ type: 'text' })
    memory: string;

    @Column({ type: 'varchar' })
    type: 'explicit' | 'implicit';

    @ManyToOne(() => AgentSession, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn()
    session: AgentSession | null;
}
