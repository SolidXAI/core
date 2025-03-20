import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { CommonEntity } from "./common.entity";
import { EmailTemplate } from "./email-template.entity";
import { IndentLogger } from "@angular-devkit/core/src/logger";

@Entity("ss_email_attachment")
export class EmailAttachment extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar" })
    name: string;
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;
    @Column({ name: "relativePath", type: "varchar", nullable: true })
    relativePath: string; // This is the path relative to the email service being used. For e.g if the attahchment is uploaded in the media manager of elastic email service
    @Column({ name: "url", type: "varchar", nullable: true })
    url: string;
    @Column({ name: "template", type: "text", nullable: true })
    template: string;
    @Index()
    @ManyToOne(() => EmailTemplate, (template) => template.attachments, { onDelete: 'CASCADE' })
    @JoinColumn()
    emailTemplate: EmailTemplate;
}