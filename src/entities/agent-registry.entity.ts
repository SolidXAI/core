import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { AgentHubTag } from './agent-hub-tag.entity';
import { AgentTool } from './agent-tool.entity';
import { AgentSkill } from './agent-skill.entity';
import { AgentRole } from './agent-role.entity';
import { AgentSecret } from './agent-secret.entity';
import { AgentProcess } from './agent-process.entity';
import { AgentSession } from './agent-session.entity';
import { AgentJob } from './agent-job.entity'
import { AgentConfigVersion } from './agent-config-version.entity';

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

    @Column({ type: "varchar", nullable: true })
    webhookUrl: string | null;

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

    @Column({ type: "varchar", nullable: true })
    runner: string | null;

    @Column({ type: "integer", default: 0 })
    minProcesses: number = 0;

    @Column({ type: "integer", nullable: true })
    maxProcesses: number | null;

    @Column({ type: "integer", nullable: true })
    processCpu: number | null;

    @Column({ type: "integer", nullable: true })
    processMemory: number | null;

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "RESTRICT", nullable: false })
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

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

    @OneToMany(() => AgentConfigVersion, configVersion => configVersion.agentRegistry)
    configVersions: AgentConfigVersion[];


    @Column({ type: "decimal", nullable: true })
    temperatureReasoningModel?: number | null;

    @Column({ type: "decimal", nullable: true })
    topPReasoningModel?: number | null;

    @Column({ type: "varchar", nullable: true })
    reasoningEffortReasoningModel?: string | null;

    @Column({ type: "decimal", nullable: true })
    temperatureFastModel?: number | null;

    @Column({ type: "decimal", nullable: true })
    topPFastModel?: number | null;

    @Column({ type: "varchar", nullable: true })
    reasoningEffortFastModel?: string | null;
}
