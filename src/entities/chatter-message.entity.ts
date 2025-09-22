import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from 'src/entities/user.entity'

@Entity("ss_chatter_message")
export class ChatterMessage extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    messageType: string; // audit | custom 
    @Column({ type: "varchar" })
    messageSubType: string; // update | insert | delete | post_message
    @Column({ type: "text" })
    messageBody: string;
    @Index()
    @Column({ type: "integer" })
    coModelEntityId: number;
    @Column({ type: "varchar" })
    coModelName: string;
    @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
    @JoinColumn()
    user: User;
}