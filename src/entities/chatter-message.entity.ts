import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from 'src/entities/user.entity'
import { ChatterMessageDetails } from './chatter-message-details.entity';
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Index(["coModelName", "coModelEntityId"])
@Entity("ss_chatter_message")
export class ChatterMessage extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    messageType: string; // audit | custom 

    @Index()
    @Column({ type: "varchar" })
    messageSubType: string; // audit_update | audit_insert | audit_delete | custom | note | task

    @Column({ nullable: true, ...getColumnType('longText') })
    messageBody: string;

    @Column({ nullable: true, ...getColumnType('longText') })
    messageBodyMentions: string;

    @Index()
    @Column({ type: "integer" })
    coModelEntityId: number;

    @Index()
    @Column({ type: "varchar" })
    coModelName: string;

    @Index()
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;

    @OneToMany(() => ChatterMessageDetails, (chatterMessageDetails) => chatterMessageDetails.chatterMessage, { cascade: true })
    chatterMessageDetails: ChatterMessageDetails[];

    @Index()
    @Column({ nullable: true })
    modelDisplayName: string;

    @Column({ nullable: true })
    modelUserKey: string;

    @Column({ default: 'pending' })
    status: string; // pending | completed

    /**
     * Odoo `mail.message.id` this row was imported from. `mail.message.id` is a single global
     * sequence in Odoo (not per-model), so this integer alone is enough to (a) prevent
     * re-importing the same Odoo message twice and (b) act as the resume cursor for a crashed
     * import - see `ChatterMessageService.runOdooChatterImport`. Uniqueness among non-null values
     * is enforced at the DB level via a filtered unique index (see migration), not via this
     * decorator, since a plain unique index would only allow a single NULL row on MSSQL.
     */
    @Index()
    @Column({ type: "integer", nullable: true })
    odooMessageId: number;
}
