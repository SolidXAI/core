import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { QueueMessage } from 'src/interfaces/mq';
import { EmailQueuePublisher } from 'src/jobs/email-publisher.service';
import commonConfig from 'src/config/common.config';
import { EmailTemplateService } from '../email-template.service';
import Handlebars from "handlebars";
import { IMail } from "../../interfaces";

const nodemailer = require("nodemailer");

export interface SMTPMailAttachment {

}

@Injectable()
export class SMTPEMailService implements IMail {
    private readonly logger = new Logger(SMTPEMailService.name);
    private readonly transporter: any;

    constructor(
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly emailPublisher: EmailQueuePublisher,
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

    async sendEmailUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueEmails = false, parentEntity = null, parentEntityId = null, attachments = []): Promise<void> {
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
        await this.sendEmail(to, subject, body, shouldQueueEmails, parentEntity, parentEntityId, attachments);
    }

    async sendEmail(to: string, subject: string, body: string, shouldQueueEmails = false, parentEntity = null, parentEntityId = null, attachments = []): Promise<void> {
        const message = {
            payload: {
                from: this.commonConfiguration.smtpMail.from,
                to: to,
                subject: subject,
                body: body
            },
            parentEntity: parentEntity,
            parentEntityId: parentEntityId,
            attachments: attachments
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

    private async sendEmailAsynchronously(message) {
        const { to, subject, body } = message.payload;
        // this.notificationPublisherService.publish(message);
        this.emailPublisher.publish(message);
        this.logger.debug(`Queueing email to ${to} with subject ${subject} and body ${body}`);
    }

    private async sendEmailSynchronously(message: QueueMessage<any>): Promise<void> {
        const { from, to, subject, body } = message.payload;
        // throw new Error('Random error....');
        const r = await this.transporter.sendMail({
            from: from,
            to: to,
            subject: subject,
            html: body
        });
        // this.logger.debug(`Sending email to ${to} with subject ${subject} and body ${body}`);
        this.logger.debug(`Sending email to ${to} with subject ${subject}`);

        return r;
    }
}