import { CommonEntity } from 'src/entities/common.entity'
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { ChatterMessage } from 'src/entities/chatter-message.entity'
@Entity("ss_chatter_message_details")
export class ChatterMessageDetails extends CommonEntity {
    @Index()
    @ManyToOne(() => ChatterMessage, { nullable: true })
    @JoinColumn()
    chatterMessage: ChatterMessage;

    @Column({ type: "text", nullable: true })
    oldValue: string;

    @Column({ type: "text", nullable: true })
    newValue: string;

    @Column({ type: "varchar", nullable: true })
    oldValueDisplay: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    newValueDisplay: string;

    @Column({ type: "varchar" })
    fieldName: string;

    @Column({ type: "text", nullable: true })
    fieldDisplayName: string;

    @Column({ type: "varchar", nullable: true })
    fieldType: string;
}