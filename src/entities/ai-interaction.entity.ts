import { CommonEntity } from 'src/entities/common.entity'
import {Entity, JoinColumn, ManyToOne, Index, Column} from 'typeorm';
import { User } from 'src/entities/user.entity'

@Entity("ss_ai_interactions")
export class AiInteraction extends CommonEntity {
    @Index()
    @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
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
    @Column({ type: "jsonb", nullable: true })
    metadata: any;
    @Column({ type: "boolean", nullable: true, default: false })
    isApplied: boolean = false;
    @Index()
    @ManyToOne(() => AiInteraction, { onDelete: "SET NULL", nullable: true })
    @JoinColumn()
    parentInteraction: AiInteraction;
    @Index({ unique: true })
    @Column({ type: "varchar" })
    externalId: string;
}