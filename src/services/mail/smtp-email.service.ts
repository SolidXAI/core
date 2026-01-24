import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Handlebars from "handlebars";
import { MailProvider } from 'src/decorators/mail-provider.decorator';
import { QueueMessage } from 'src/interfaces/mq';
import { IMail, MailAttachment, MailAttachmentWrapper } from "../../interfaces";
import { EmailTemplateService } from '../email-template.service';
import { PublisherFactory } from '../queues/publisher-factory.service';
import { SettingService } from '../setting.service';
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

const nodemailer = require("nodemailer");

@Injectable()
@MailProvider()
export class SMTPEMailService implements IMail {
    private readonly logger = new Logger(SMTPEMailService.name);
    private readonly transporter: any;

    constructor(
        // private readonly emailPublisher: EmailQueuePublisher,
        // private readonly emailDbPublisher: EmailQueueDbPublisher,
        private readonly publisherFactory: PublisherFactory<any>,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly settingService: SettingService

    ) {

        const host = process.env.COMMON_SMTP_EMAIL_SMTP_HOST;
        const port = +(process.env.COMMON_SMTP_EMAIL_SMTP_PORT ?? 587);
        const username = process.env.COMMON_SMTP_EMAIL_USERNAME;
        const password = process.env.COMMON_SMTP_EMAIL_PASSWORD;
        const from = process.env.COMMON_SMTP_EMAIL_FROM ?? process.env.COMMON_EMAIL_FROM;

        this.transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: port === 465,
            auth: {
                user: username,
                pass: password
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
    ) {
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
        return await this.sendEmail(to, subject, body, shouldQueueEmails, wrapperAttachments, attachments, parentEntity, parentEntityId, cc, bcc, from);
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
    ) {
        const message = {
            payload: {
                from: from || this.settingService.getConfigValue<SolidCoreSetting>("smtpMailFrom"),
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
            return this.sendEmailAsynchronously(message);
        }
        // If developer has not, however system config mandates that we send using queue, still we send.
        else if (shouldQueueEmails == false && this.settingService.getConfigValue<SolidCoreSetting>("shouldQueueEmails") === true) {
            return this.sendEmailAsynchronously(message);
        }
        // Else we send synchronously
        else {
            return await this.sendEmailSynchronously(message);
        }
    }

    async sendEmailAsynchronously(message) {
        const { to, subject, body } = message.payload;
        this.logger.debug(`Queueing email to ${to} with subject ${subject} and body ${body}`);
        return this.publisherFactory.publish(message, 'SmtpEmailQueuePublisher');
    }

    async sendEmailSynchronously(message: QueueMessage<any>) {
        let from;
        const { to, subject, body, attachments = [], cc, bcc } = message.payload;

        const envFrom = this.settingService.getConfigValue<SolidCoreSetting>("smtpMailFrom");
        if (envFrom) {
            from = envFrom;
        }

        // if any of the required fields are missing, throw an error.
        if (!from || !to || !subject || !body) {
            this.logger.error(`Required fields are missing in the email message: ${JSON.stringify(message.payload)}`);
            return;
        }

        const attachmentsList = attachments?.map((attachment: MailAttachment) => {
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
        }) || [];

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
        // this.logger.debug(`Sending email to ${to} with subject ${subject}`);

        return r;
    }
}