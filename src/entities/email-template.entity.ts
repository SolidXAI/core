import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity, OneToMany, Index } from 'typeorm';
import { EmailAttachment } from './email-attachment.entity';

@Entity("ss_email_template")
@Index(["name", "deletedTracker"], { unique: true })
export class EmailTemplate extends CommonEntity {
    @OneToMany(() => EmailAttachment, (attachment) => attachment.emailTemplate, { cascade: true })
    attachments: EmailAttachment[];
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;
    @Column({ name: "body", type: "varchar" })
    body: string;
    @Column({ name: "subject", type: "varchar", default: "{}" })
    subject: string = "{}";
    @Column({ name: "description", type: "text", nullable: true })
    description: string;
    @Column({ name: "active", type: "boolean", nullable: true, default: true })
    active: boolean = true;

@Index()
@Column({ name: "type", type: "varchar", default: "text" })
type: string = "text";
}