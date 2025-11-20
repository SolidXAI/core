import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from 'src/entities/user.entity'

@Entity("ss_setting")
export class Setting extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    key: string;
    @Column({ type: "varchar", nullable: true })
    value: string;
    @Column({ name: "type", type: "varchar", nullable: true })
    type: string;
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;
}