import { CommonEntity } from 'src/entities/common.entity'
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { User } from 'src/entities/user.entity'

@Entity("ss_ai_interactions")
export class AiInteraction extends CommonEntity {
    @Index()
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;

    @Index()
    @Column({ type: "varchar" })
    threadId: string;

    @Column({ type: "varchar" })
    role: string;

    @Column({ type: "text" })
    message: string;

    @Column({ type: "varchar", nullable: true })
    contentType: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    status: string;

    @Column({ type: "text", nullable: true })
    errorMessage: string;

    @Column({ type: "varchar", nullable: true })
    modelUsed: string;

    @Column({ type: "integer", nullable: true })
    responseTimeMs: number;

    @Column({ type: "simple-json", nullable: true })
    metadata: any;

    @Column({ nullable: true, default: false })
    isApplied: boolean = false;

    @Index()
    @ManyToOne(() => AiInteraction, { nullable: true })
    @JoinColumn()
    parentInteraction: AiInteraction;

    @Index({ unique: true })
    @Column({ type: "varchar" })
    externalId: string;

    @Column({ nullable: true, default: false })
    isAutoApply: boolean = false;

    @Column({ type: "integer", nullable: true })
    inputTokens: number;

    @Column({ type: "integer", nullable: true })
    outputTokens: number;

    @Column({ type: "integer", nullable: true })
    totalTokens: number;

    @Column({ type: "text", nullable: true })
    originalMessage: string;

    @Column({ nullable: true, default: false })
    isEdited: boolean = false;
}
