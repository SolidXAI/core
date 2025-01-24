import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { EmailAttachment } from './email-attachment.entity';


@Entity("ss_email_template")
export class EmailTemplate extends CommonEntity {
    @Column({ unique: true })
    name: string;

    @Column()
    displayName: string;

    @Column({ type: 'text' })
    body: string;

    @Column({ length: 128 })
    subject: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ default: false })
    active: boolean;

    @OneToMany(() => EmailAttachment, (attachment) => attachment.emailTemplate, { cascade: true })
    attachments: EmailAttachment[];
}