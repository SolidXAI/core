import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { Msg91BaseSMSService } from "./Msg91BaseSMSService";
import { ISMS } from "../../interfaces";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { SettingService } from "../setting.service";
import { SmsProvider } from "src/decorators/sms-provider.decorator";

@Injectable()
@SmsProvider()
export class Msg91SMSService extends Msg91BaseSMSService implements ISMS {
    constructor(
        settingService: SettingService,

        // smsPublisher: SmsQueuePublisher,
        publisherFactory: PublisherFactory<any>,
        smsTemplateService: SmsTemplateService,
        private readonly httpService: HttpService,
    ) {
        super(settingService, 'Msg91SmsQueuePublisher', publisherFactory, smsTemplateService)
    }

    async sendSMSSynchronously(message: QueueMessage<any>): Promise<any> {
        const { to, templateId, ...templateParams } = message.payload;
        const body = { template_id: templateId, short_url: "0", recipients: [{ mobiles: to, ...templateParams }] };
        const headers = { "authkey": await this.settingService.getConfigValue("sms", "msg91SmsApiKey") };
        await this.httpService.axiosRef.post(`${await this.settingService.getConfigValue("sms", "msg91SmsUrl")}/flow`, body, { headers });
        this.logger.debug(`Sending SMS to ${to} with body ${JSON.stringify(body)} and headers ${JSON.stringify(headers)}`);
    }
}