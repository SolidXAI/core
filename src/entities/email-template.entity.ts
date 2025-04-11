import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity, OneToMany, Index } from 'typeorm';
import { EmailAttachment } from './email-attachment.entity';

@Entity("ss_email_template")
export class EmailTemplate extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar", unique: true })
    name: string;
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;
    @Column({ name: "body", type: "varchar", default: '' })
    body: string;
    @Column({ name: "subject", type: "varchar", default: "{}" })
    subject: string = "{}";
    @Column({ name: "description", type: "text", nullable: true })
    description: string;
    @Column({ name: "active", type: "boolean", nullable: true, default: true })
    active: boolean = true;
    @OneToMany(() => EmailAttachment, (attachment) => attachment.emailTemplate, { cascade: true })
    attachments: EmailAttachment[];
    @Column({ name: "type", type: "varchar", nullable: true })
    type: string;
}