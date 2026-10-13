import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { AgentHubTag } from './agent-hub-tag.entity';
import { AgentTool } from './agent-tool.entity';
import { AgentSkill } from './agent-skill.entity';
import { AgentRole } from './agent-role.entity';
import { AgentSecret } from './agent-secret.entity';
import { AgentProcess } from './agent-process.entity';
import { AgentSession } from './agent-session.entity';
import { AgentJob } from './agent-job.entity'

@Entity('ss_agent_registry')
export class AgentRegistry extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "varchar" })
    title: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "varchar", nullable: true })
    iconName: string;

    @Column({ type: "text" })
    systemPrompt: string;

    /** JSON array of { name, description, dataType, defaultValue, optional } consumed by AgentHub. */
    @Column({ type: "text", default: "[]" })
    requiredInputs: string = "[]";

    @Column({ type: "varchar" })
    reasoningModelKey: string;

    @Column({ type: "varchar" })
    fastModelKey: string;

    @Column({ type: "varchar", default: "draft" })
    status: string = "draft";

    @Column({ type: "integer" })
    stepLimit: number = 100;

    @Column({ type: "integer" })
    turnStepLimit: number = 20;

    @Column({ type: "decimal", default: 3 })
    costLimit: number = 3;

    @Column({ type: "integer", nullable: true, default: 1 })
    configVersion?: number = 1;

    @ManyToMany(() => AgentHubTag, tag => tag.agents, { cascade: ['insert', 'update'] })
    @JoinTable()
    tags: AgentHubTag[];

    @OneToMany(() => AgentTool, agentTool => agentTool.agentRegistry, { cascade: true })
    agentTools: AgentTool[];

    @OneToMany(() => AgentSkill, agentSkill => agentSkill.agentRegistry, { cascade: true })
    agentSkills: AgentSkill[];

    @OneToMany(() => AgentRole, agentRole => agentRole.agentRegistry, { cascade: true })
    agentRoles: AgentRole[];

    @OneToMany(() => AgentSecret, agentSecret => agentSecret.agentRegistry, { cascade: true })
    agentSecrets: AgentSecret[];

    @OneToMany(() => AgentProcess, agentProcess => agentProcess.agent, { cascade: true })
    agentProcesses: AgentProcess[];

    @OneToMany(() => AgentSession, agentSession => agentSession.agent, { cascade: true })
    agentSessions: AgentSession[];

    @OneToMany(() => AgentJob, agentJob => agentJob.agent, { cascade: true })
    agentJobs: AgentJob[];
}
