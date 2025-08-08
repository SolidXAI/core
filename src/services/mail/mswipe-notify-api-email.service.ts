import { Inject, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { IMail, MailAttachment } from "src/interfaces";
import { EmailTemplateService } from "../email-template.service";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { QueueMessage } from "src/interfaces/mq";

export class MswipeNotifyApiEmailService implements IMail {
    private readonly logger = new Logger(this.constructor.name);
    private readonly client: any; // Replace with actual client implementation
    constructor(
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly publisherFactory: PublisherFactory<any>,
        private readonly emailTemplateService: EmailTemplateService,
    ) {
        // Initialize the Mswipe Notify API client here
        this.client = {}; // FIXME:Placeholder for actual client initialization
    }

    async sendEmailUsingTemplate(
        to: string,
        templateName: string,
        templateParams: any,
        shouldQueueEmails: boolean,
        wrapperAttachments?: any[], // deprecated
        attachments?: MailAttachment[],
        parentEntity?: any, // rarely used
        parentEntityId?: any // rarely used
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
        await this.sendEmail(to, subject, body, shouldQueueEmails, parentEntity, parentEntityId, attachments);
    }

    async sendEmail(
        to: string,
        subject: string,
        body: string,
        shouldQueueEmails: boolean,
        wrapperAttachments?: any[], // deprecated
        attachments?: MailAttachment[],
        parentEntity?: any, // rarely used
        parentEntityId?: any // rarely used
    ): Promise<void> {
        const message = {
            payload: {
                from: this.commonConfiguration.apiMail.from,
                to: to,
                subject: subject,
                body: body,
                attachments: attachments,
            }
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

    async sendEmailAsynchronously(message: QueueMessage<any>): Promise<void> {
        const { to, subject, body } = message.payload;

        this.publisherFactory.publish(message, 'MswipeNotifyApiEmailQueuePublisher');

        this.logger.debug(`Queueing email to ${to} with subject ${subject} and body ${body}`);
    }

    //FIXME: Implement the actual synchronous email sending logic using the Mswipe Notify API
    async sendEmailSynchronously(message: QueueMessage<any>): Promise<void> {
        const { from, to, subject, body, attachments } = message.payload;

        // do something with this.client to send the email

        this.logger.debug(`Sending email to ${to} with subject ${subject} and body ${body}`);
        // Implement synchronous email sending logic here
    }

}
