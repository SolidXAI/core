import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { ModuleMetadata } from 'src/entities/module-metadata.entity'

@Entity('ss_dashboard_user_layout')
export class DashboardUserLayout extends CommonEntity {
    @Index()
    @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    user: User;

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    module: ModuleMetadata;

    @Index()
    @Column({ name: "dashboard_name", type: "varchar" })
    dashboardName: string;

    @Column({ name: "layout_json", type: "text" })
    layoutJson: string;

    @Column({ type: "integer", nullable: true })
    version: number;
}