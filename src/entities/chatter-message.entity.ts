import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from 'src/entities/user.entity'
import { ChatterMessageDetails } from './chatter-message-details.entity';

@Entity("ss_chatter_message")
export class ChatterMessage extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    messageType: string; // audit | custom 
    @Column({ type: "varchar" })
    messageSubType: string; // audit_update | audit_insert | audit_delete | custom
    @Column({ type: "text", nullable: true })
    messageBody: string;
    @Index()
    @Column({ type: "integer" })
    coModelEntityId: number;
    @Column({ type: "varchar" })
    coModelName: string;
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;
    @OneToMany(() => ChatterMessageDetails, (chatterMessageDetails) => chatterMessageDetails.chatterMessage, { cascade: true })
    chatterMessageDetails: ChatterMessageDetails[];
    @Column({ type: "text", nullable: true })
    modelDisplayName: string;
    @Column({ type: "text", nullable: true })
    modelUserKey: string;
}