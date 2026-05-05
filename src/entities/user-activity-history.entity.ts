import { CommonEntity } from 'src/entities/common.entity'
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { User } from 'src/entities/user.entity'
@Entity("ss_user_activity_history")
export class UserActivityHistory extends CommonEntity {
    @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn()
    user: User;

    @Index()
    @Column({ type: "varchar", nullable: true })
    event: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    ipAddress: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    userAgent: string;
}