import { CommonEntity } from 'src/entities/common.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity("ss_security_rule")
export class SecurityRule extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Index()
    @Column({ type: "varchar" })
    description: string;

    @Index()
    @ManyToOne(() => RoleMetadata, { nullable: false })
    @JoinColumn()
    role: RoleMetadata;

    @Index()
    @ManyToOne(() => ModelMetadata, { nullable: false })
    @JoinColumn()
    modelMetadata: ModelMetadata;

    @Column({ ...getColumnType('longText'), nullable: true })
    securityRuleConfig: any;

    @Column({ type: "varchar", nullable: true })
    securityRuleConfigProvider: string;
}
