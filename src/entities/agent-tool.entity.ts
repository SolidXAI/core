import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentToolRegistry } from './agent-tool-registry.entity'

@Entity('ss_agent_tool')
export class AgentTool extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentRegistry: AgentRegistry;

    @ManyToOne(() => AgentToolRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentToolRegistry: AgentToolRegistry;

    @Column({ type: "boolean", default: false })
    requiresApproval: boolean = false;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    agentToolKey: string;
}
