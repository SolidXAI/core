import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { AgentRegistry } from './agent-registry.entity';
import { AgentToolRegistry } from './agent-tool-registry.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity('ss_agent_tool')
export class AgentTool extends CommonEntity {
    @ManyToOne(() => AgentRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentRegistry: AgentRegistry;

    @ManyToOne(() => AgentToolRegistry, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    agentToolRegistry: AgentToolRegistry;

    @Column({ ...getColumnType('boolean'), default: false })
    requiresApproval: boolean = false;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    agentToolKey: string;
}
