import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { SmsQueuePublisher } from "src/jobs/sms-publisher.service";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { Msg91BaseSMSService } from "./Msg91BaseSMSService";
import { ISMS } from "../../interfaces";

@Injectable()
export class Msg91SMSService extends Msg91BaseSMSService implements ISMS {
    constructor(
        @Inject(commonConfig.KEY)
        commonConfiguration: ConfigType<typeof commonConfig>,
        smsPublisher: SmsQueuePublisher,
        smsTemplateService: SmsTemplateService,
        private readonly httpService: HttpService,
    ) {
        super( commonConfiguration, smsPublisher, smsTemplateService )     
     }

    async sendSMSSynchronously(message: QueueMessage<any>): Promise<void> {
        const { to, templateId, ...templateParams } = message.payload;
        const body = { template_id: templateId, short_url: "0", recipients: [{ mobiles: to, ...templateParams }] };
        const headers = { "authkey": this.commonConfiguration.msg91Sms.apiKey };
        await this.httpService.axiosRef.post(`${this.commonConfiguration.msg91Sms.url}/flow`, body, { headers });
        this.logger.debug(`Sending SMS to ${to} with body ${JSON.stringify(body)} and headers ${JSON.stringify(headers)}`);
    }
}