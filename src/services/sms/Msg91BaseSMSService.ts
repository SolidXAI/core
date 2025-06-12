import { Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import Handlebars from "handlebars";
import commonConfig from "src/config/common.config";
import { SmsQueuePublisher } from "src/jobs/sms-publisher.service";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { RabbitMqPublisher } from "src/services/queues/rabbitmq-publisher.service";
import { ISMS } from "../../interfaces";

export abstract class Msg91BaseSMSService implements ISMS {
    protected readonly logger = new Logger(Msg91BaseSMSService.name);
    constructor(
        protected readonly commonConfiguration: ConfigType<typeof commonConfig>,
        protected readonly smsPublisher: RabbitMqPublisher<any>,
        protected readonly smsTemplateService: SmsTemplateService,
    ) { }

    sendSMS(_to: string, _body: string, _shouldQueueSms: boolean): Promise<void> {
        throw new Error(`Msg91 does not support sending plain text messages, you need to register a template and use the templateId to send the SMS.`);
    }

    async sendSMSUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueSms = false): Promise<void> {
        // Load template and evaluate it. 
        const emailTemplate = await this.smsTemplateService.findOneByName(templateName);
        if (!emailTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }

        // Evaluate the body template.
        let body = null;
        let templateId = null;

        // The below code is only for reference, msh91 maintains the SMS templates in their database, and we need to only specify the templateId. 
        // The below was designed assuming that there are certain sms gateways who do not work this way.
        if (emailTemplate.body) {
            const bodyTemplate = Handlebars.compile(emailTemplate.body);
            body = bodyTemplate(templateParams);
        }
        if (emailTemplate.smsProviderTemplateId) {
            templateId = emailTemplate.smsProviderTemplateId;
        }
        if (!body && !templateId) {
            throw new Error(`Invalid template, neither body nor templateId specified on template with name ${templateName}`);
        }

        const message = {
            payload: {
                ...templateParams,
                to: to,
                templateId: templateId,
            },
            // parentEntity: 'Address', //FIXME Need to dynamically set this
            // parentEntityId: 23, //FIXME Need to dynamically set this
        };

        // Send using queue if the developer has explicitly invoked with true.
        if (shouldQueueSms === true) {
            await this.sendSMSAsynchronously(message);
        }
        // If developer has not, however system config mandates that we send using queue, still we send.
        else if (shouldQueueSms === false && this.commonConfiguration.shouldQueueSms === true) {
            await this.sendSMSAsynchronously(message);
        }
        // Else we send synch
        else {
            await this.sendSMSSynchronously(message);
        }
    }

    async sendSMSAsynchronously(message) {
        const { to } = message.payload;
        // this.notificationPublisherService.publish(message);
        this.smsPublisher.publish(message);
        this.logger.debug(`Queueing SMS to ${to} with message ${JSON.stringify(message)}`);
    }

    abstract sendSMSSynchronously(message: QueueMessage<any>): Promise<void>
}