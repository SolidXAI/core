import { CommonEntity } from 'src/entities/common.entity'
import { Entity, JoinColumn, ManyToOne, Column, Index } from 'typeorm';
import { ChatterMessage } from 'src/entities/chatter-message.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';
@Entity("ss_chatter_message_details")
export class ChatterMessageDetails extends CommonEntity {
    @Index()
    @ManyToOne(() => ChatterMessage, { nullable: true })
    @JoinColumn()
    chatterMessage: ChatterMessage;

    @Column({ nullable: true, ...getColumnType('longText') })
    oldValue: string;

    @Column({ nullable: true, ...getColumnType('longText') })
    newValue: string;

    @Column({ type: "varchar", nullable: true })
    oldValueDisplay: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    newValueDisplay: string;

    @Column({ type: "varchar" })
    fieldName: string;

    @Column({ nullable: true })
    fieldDisplayName: string;
}