import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { QueueMessage } from 'src/interfaces/mq';
import commonConfig from 'src/config/common.config';
import { EmailTemplateService } from '../email-template.service';
import Handlebars from "handlebars";
import { IMail, MailAttachment, MailAttachmentWrapper } from "../../interfaces";
import { PublisherFactory } from '../queues/publisher-factory.service';
import Mail from 'nodemailer/lib/mailer';

const nodemailer = require("nodemailer");

@Injectable()
export class SMTPEMailService implements IMail {
    private readonly logger = new Logger(SMTPEMailService.name);
    private readonly transporter: any;

    constructor(
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        // private readonly emailPublisher: EmailQueuePublisher,
        // private readonly emailDbPublisher: EmailQueueDbPublisher,
        private readonly publisherFactory: PublisherFactory<any>,
        private readonly emailTemplateService: EmailTemplateService,
    ) {
        this.transporter = nodemailer.createTransport({
            host: this.commonConfiguration.smtpMail.host,
            port: this.commonConfiguration.smtpMail.port,
            secure: this.commonConfiguration.smtpMail.port === 465,
            auth: {
                user: this.commonConfiguration.smtpMail.username,
                pass: this.commonConfiguration.smtpMail.password
            }
        });
    }

    async sendEmailUsingTemplate(
        to: string,
        templateName: string,
        templateParams: any,
        shouldQueueEmails = false,
        wrapperAttachments?: MailAttachmentWrapper[],
        attachments?: MailAttachment[],
        parentEntity?: any,
        parentEntityId?: any,
        cc?: string[],
        bcc?: string[],
        from?: string
    ): Promise<void> {
        // Load template and evaluate it.
        const emailTemplate = await this.emailTemplateService.findOneByName(templateName);
        if (!emailTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }

        // Evaluate the body template.
        const bodyTemplate = Handlebars.compile(emailTemplate.body);
        const body = bodyTemplate(templateParams);

        // Evaluate the subject template 
        const subjectTemplate = Handlebars.compile(emailTemplate.subject);
        const subject = subjectTemplate(templateParams);

        // Finally send the email.
        await this.sendEmail(to, subject, body, shouldQueueEmails, wrapperAttachments, attachments, parentEntity, parentEntityId, cc, bcc, from);
    }

    async sendEmail(
        to: string,
        subject: string,
        body: string,
        shouldQueueEmails = false,
        wrapperAttachments?: MailAttachmentWrapper[],
        attachments?: MailAttachment[],
        parentEntity?: any,
        parentEntityId?: any,
        cc?: string[],
        bcc?: string[],
        from?: string
    ): Promise<void> {
        const message = {
            payload: {
                from: from || this.commonConfiguration.smtpMail.from,
                to: to,
                subject: subject,
                body: body,
                attachments: attachments,
                cc: cc,
                bcc: bcc,
            },
            parentEntity: parentEntity,
            parentEntityId: parentEntityId,
        };

        // Send using queue if the developer has explicitly invoked with true.
        if (shouldQueueEmails === true) {
            this.sendEmailAsynchronously(message);
        }
        // If developer has not, however system config mandates that we send using queue, still we send.
        else if (shouldQueueEmails == false && this.commonConfiguration.shouldQueueEmails === true) {
            this.sendEmailAsynchronously(message);
        }
        // Else we send synch
        else {
            await this.sendEmailSynchronously(message);
        }
    }

    async sendEmailAsynchronously(message) {
        const { to, subject, body } = message.payload;
        // this.notificationPublisherService.publish(message);
        // this.emailPublisher.publish(message);
        // this.emailDbPublisher.publish(message);

        this.publisherFactory.publish(message, 'SmtpEmailQueuePublisher');

        this.logger.debug(`Queueing email to ${to} with subject ${subject} and body ${body}`);
    }

    async sendEmailSynchronously(message: QueueMessage<any>): Promise<void> {
        const { from, to, subject, body, attachments, cc, bcc } = message.payload;

        const attachmentsList = attachments.map((attachment: MailAttachment) => {
            const attachmentEntry = {
                filename: attachment.filename,
                contentType: attachment.contentType,
            }
            if (attachment.path) {
                attachmentEntry['path'] = attachment.path;
            }
            if (attachment.content) {
                attachmentEntry['content'] = attachment.content;
            }
            return attachmentEntry;
        });

        // throw new Error('Random error....');
        const r = await this.transporter.sendMail({
            from: from,
            to: to,
            cc: cc,
            bcc: bcc,
            subject: subject,
            html: body,
            attachments: attachmentsList,
        });
        // this.logger.debug(`Sending email to ${to} with subject ${subject} and body ${body}`);
        this.logger.debug(`Sending email to ${to} with subject ${subject}`);

        return r;
    }
}