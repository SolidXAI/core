import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index, JoinColumn, ManyToOne} from 'typeorm';
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity'

@Entity("ss_security_rule")
export class SecurityRule extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;
    @Index({ unique: true })
    @Column({ type: "varchar" })
    description: string;
    @Index()
    @ManyToOne(() => RoleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    role: RoleMetadata;
    @Index()
    @ManyToOne(() => ModelMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    modelMetadata: ModelMetadata;
    @Column({ type: "text" })
    securityRuleConfig: any;
}