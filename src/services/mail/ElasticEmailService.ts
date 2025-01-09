import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Handlebars, { template } from "handlebars";
import commonConfig from 'src/config/common.config';
import { EmailAttachment } from 'src/entities/email-attachment.entity';
import { ApiEmailQueuePublisher } from 'src/jobs/api-email-publisher.service';
import { QueueMessage } from 'src/interfaces/mq';
import { EmailTemplateService } from '../email-template.service';
import { PdfService } from '../pdf.service';
import { FileService } from '../file.service';
import { IMail, MailAttachment, MailAttachmentWrapper } from "../../interfaces";

const ElasticEmail = require('@elasticemail/elasticemail-client');

@Injectable()
export class ElasticEmailService implements IMail {
    private readonly logger = new Logger(ElasticEmailService.name);
    private readonly emailsApi;

    constructor(
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly emailPublisher: ApiEmailQueuePublisher,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly pdfService: PdfService,
        private readonly fileService: FileService,
    ) {
        const client = ElasticEmail.ApiClient.instance;
        const apikey = client.authentications['apikey'];
        apikey.apiKey = commonConfiguration.apiMail.key;
        this.emailsApi = new ElasticEmail.EmailsApi();
    }

    async sendEmailUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueEmails = false, parentEntity = null, parentEntityId = null): Promise<void> {
        // Load template and evaluate it. 
        const emailTemplate = await this.emailTemplateService.findOneByName(templateName, { attachments: true });
        if (!emailTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }

        // Evaluate the body template.
        const bodyTemplate = Handlebars.compile(emailTemplate.body);
        const body = bodyTemplate(templateParams);

        // Evaluate the subject template 
        const subjectTemplate = Handlebars.compile(emailTemplate.subject);
        const subject = subjectTemplate(templateParams);

        // Populate the email with the template.
        const emailTemplateAttachments = emailTemplate.attachments;
        const attachmentWrappers: MailAttachmentWrapper[] = [];
        for (const attachment of emailTemplateAttachments) {
            const attachmentWrapper = await this.toAttachmentWrapper(attachment, templateParams);
            attachmentWrappers.push(attachmentWrapper);
        }

        // Finally send the email.
        await this.sendEmail(to, subject, body, shouldQueueEmails, parentEntity, parentEntityId, attachmentWrappers);
    }

    async sendEmail(to: string, subject: string, body: string, shouldQueueEmails = false, parentEntity = null, parentEntityId = null, wrapperAttachments: MailAttachmentWrapper[] = []): Promise<void> {
        const message = {
            payload: {
                from: this.commonConfiguration.smtpMail.from,
                to: to,
                subject: subject,
                body: body,
                wrapperAttachments: wrapperAttachments,
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

    async sendEmailAsynchronously(message: QueueMessage<any>) {
        const { to, subject, body } = message.payload;
        // this.notificationPublisherService.publish(message);
        this.emailPublisher.publish(message);
        this.logger.debug(`Queueing email to ${to} with subject ${subject} and body ${body}`);
    }

    async sendEmailSynchronously(message: QueueMessage<any>): Promise<void> {
        const { from, to, subject, body, wrapperAttachments }: { from: string, to: string, subject: string, body: string, wrapperAttachments: MailAttachmentWrapper[] } = message.payload;
        const emailData = {
            Recipients: {
                To: [to]
            },
            Content: {
                Body: [
                    {
                        ContentType: "HTML", //ContentType Text version is handled by elastic email automatically through a config setting
                        Charset: "utf-8",
                        Content: body
                    }
                ],
                From: from,
                Subject: subject
            }
        };

        // Handle relative attachments i.e attachments that are uploaded to the email service.
        const relativeAttachments = wrapperAttachments.filter(wrapperAttachment => wrapperAttachment.relativePath);
        if (relativeAttachments.length > 0) {
            emailData.Content['AttachFiles'] = relativeAttachments.map(attachment => attachment.relativePath);
        }

        const binaryAttachments = wrapperAttachments.filter(wrapperAttachment => wrapperAttachment.attachment);
        if (binaryAttachments.length > 0) {
            //FIXME Replace this with actual attachment.
            // const dummyAttachmentBuffer = await this.dummyAttachment();
            // emailData.Content['Attachments'] = [{
            //     "BinaryContent": dummyAttachmentBuffer.toString('base64'),
            //     "Name": "Invoice.pdf", 
            // }];
            const attachments = [];
            for (const wrapperAttachment of binaryAttachments) {
                const attachment = await this.toMessageAttachment(wrapperAttachment.attachment, wrapperAttachment.attachment.templateParams);
                attachments.push(attachment);
            }
            emailData.Content['Attachments'] = attachments;
        }

        const callback = (error, _data, _response) => {
            if (error) {
                this.logger.debug(`Error while sending email to ${to} with subject ${subject}`, error);
            } else {
                this.logger.debug(`Sending email to ${to} with subject ${subject}`);
            }
        };

        this.emailsApi.emailsTransactionalPost(emailData, callback);
    }

    private async toAttachmentWrapper(attachment: EmailAttachment, templateParams: any): Promise<MailAttachmentWrapper> {
        const attachmentWrapper: MailAttachmentWrapper = {}
        if (attachment.template) {
            attachmentWrapper.attachment = {
                filename: attachment.displayName,
                templatePath: attachment.template,
                templateParams: templateParams,
            }
        } else {
            attachmentWrapper.relativePath = attachment.relativePath
        }
        return attachmentWrapper;
    }

    private async toMessageAttachment(attachment: MailAttachment, templateParams: any): Promise<any> {
        const attachmentContent = await this.getAttachmentAsPDF(attachment.templatePath, templateParams);
        return {
            "BinaryContent": attachmentContent.toString('base64'),
            "Name": attachment.filename,
        }
    }

    private async getAttachmentAsPDF(attachmentTemplatePath: string, templateParams: any): Promise<Buffer> {
        const template = await this.fileService.readFile(attachmentTemplatePath)
        const bodyTemplate = Handlebars.compile(template);
        const html = bodyTemplate(templateParams);
        const pdfBuffer = await this.pdfService.generatePdf(html);
        const buffer = Buffer.from(pdfBuffer);
        return buffer;
    }
}