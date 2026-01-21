import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from 'src/entities/user.entity'
import { ModuleMetadata } from './module-metadata.entity';

@Entity("ss_setting")
export class Setting extends CommonEntity {

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: false })
    key: string;

    @Column({ type: "varchar", nullable: true })
    value: string;

    @Column({ name: "type", type: "varchar", nullable: true })
    type: string;

    @Column({ name: "level", type: "varchar", nullable: true })
    level: string;

    @Index()
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;

    @Index()
    @ManyToOne(() => ModuleMetadata, { nullable: true })
    @JoinColumn()
    moduleMetadata: ModuleMetadata;
}
