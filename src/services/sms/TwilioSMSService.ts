import Handlebars from "handlebars";
import { Injectable, Logger } from "@nestjs/common";
import { SmsTemplateService } from "../sms-template.service";
import { ISMS } from "../../interfaces";
import { PublisherFactory } from "../queues/publisher-factory.service";
import twilio from 'twilio';
import { QueueMessage } from "src/interfaces/mq";
import { SettingService } from "../setting.service";
import { SmsProvider } from "src/decorators/sms-provider.decorator";


@Injectable()
@SmsProvider()
export class TwilioSMSService implements ISMS {
    private readonly logger = new Logger(TwilioSMSService.name);

    constructor(
        private publisherFactory: PublisherFactory<any>,
        private smsTemplateService: SmsTemplateService,
        private settingService: SettingService
    ) {
        // super(commonConfiguration, 'OTPQueuePublisher', publisherFactory, smsTemplateService);
    }

    async sendSMS(to: string, body: string, shouldQueueSms: boolean): Promise<any> {



        const accountSid = this.settingService.getConfigValue('twilioAccountSid');
        const authToken = this.settingService.getConfigValue('twilioAuthToken');
        const twilioNumber = this.settingService.getConfigValue('twilioNumber');
        if (!accountSid || !authToken || !twilioNumber) {
            throw new Error("Missing COMMON_TWILIO_ACCOUNT_SID or COMMON_TWILIO_AUTH_TOKEN or COMMON_TWILIO_NUMBER in env.");
        }

        const message = {
            payload: {
                body: body,
                to: to,
            },
        };

        // Send using queue if the developer has explicitly invoked with true.
        if (shouldQueueSms === true) {
            await this.sendSMSAsynchronously(message);
        }
        // If developer has not, however system config mandates that we send using queue, still we send.
        else if (shouldQueueSms === false && this.settingService.getConfigValue('shouldQueueSms') === true) {
            await this.sendSMSAsynchronously(message);
        }
        // Else we send synch
        else {
            await this.sendSMSSynchronously(message);
        }

        return message;
    }

    async sendSMSUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueSms: boolean): Promise<any> {
        // Load template and evaluate it.
        const smsTemplate = await this.smsTemplateService.findOneByName(templateName);
        if (!smsTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }

        // Evaluate the body template.
        let body = '';
        try {
            const bodyTemplate = Handlebars.compile(smsTemplate.body);
            body = bodyTemplate(templateParams);
        } catch (error) {
            throw new Error('Unable to compile sms template body');
        }
        // Finally send the email.
        return await this.sendSMS(to, body, shouldQueueSms);

    }

    async sendSMSAsynchronously(message) {
        const { to } = message.payload;
        this.publisherFactory.publish(message, 'TwilioSmsQueuePublisher');
        this.logger.debug(`Queueing SMS to ${to} with message ${JSON.stringify(message)}`);
    }

    async sendSMSSynchronously(message: QueueMessage<any>): Promise<any> {
        const accountSid = this.settingService.getConfigValue('twilioAccountSid');
        const authToken = this.settingService.getConfigValue('twilioAuthToken');
        const twilioNumber = this.settingService.getConfigValue('twilioNumber');

        if (!accountSid || !authToken || !twilioNumber) {
            throw new Error("Missing COMMON_TWILIO_ACCOUNT_SID or COMMON_TWILIO_AUTH_TOKEN or COMMON_TWILIO_NUMBER in env.");
        }
        const { to, body } = message.payload;
        const client = twilio(accountSid, authToken);
        try {
            const toSplit = to.split(',');
            const r = [];
            for (let i = 0; i < toSplit.length; i++) {
                const actualTo = toSplit[i];
                const twilioResponseMsg = await client.messages.create({
                    body: body,
                    from: twilioNumber,
                    to: actualTo,
                });
                this.logger.debug(`Sending SMS to ${actualTo} using Twilio`);
                this.logger.debug(`Twilio response: `);
                this.logger.debug(JSON.stringify(twilioResponseMsg))
                r.push(twilioResponseMsg);
            }

            return r;
        } catch (error) {
            throw new Error(error);
        }
    }
}