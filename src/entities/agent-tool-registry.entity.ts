import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, OneToMany } from 'typeorm';
import { AgentTool } from './agent-tool.entity'

@Entity('ss_agent_tool_registry')
export class AgentToolRegistry extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "varchar" })
    type: string;

    @Column({ type: "varchar", nullable: true })
    iconName?: string;

    @Column({ type: "text" })
    description: string;

    @Column({ type: "text", default: "[]" })
    tags: string = "[]";

    @Column({ type: "text" })
    sourceCode: string = "";

    @Column({ type: "varchar", nullable: true })
    checksum?: string;

    @Column({ type: "varchar", default: "active" })
    status: string = "active";

    @Column({ type: "text", nullable: true })
    lastLoadError: string;

    @OneToMany(() => AgentTool, agentTool => agentTool.agentToolRegistry, { cascade: true })
    agentTools: AgentTool[];
}
