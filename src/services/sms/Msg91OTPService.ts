import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { Msg91BaseSMSService } from "./Msg91BaseSMSService";
import { ISMS } from "../../interfaces";
import { PublisherFactory } from "../queues/publisher-factory.service";
import { SettingService } from "../setting.service";
import { SmsProvider } from "src/decorators/sms-provider.decorator";
import type { SolidCoreSetting } from "src/services/settings/default-settings-provider.service";

interface OtpParams {
    otp: string,
    template_id: string,
    mobile: string,
    authkey: string
}

@Injectable()
@SmsProvider()
export class Msg91OTPService extends Msg91BaseSMSService implements ISMS {
    constructor(
        settingService: SettingService,
        // smsPublisher: OTPQueuePublisher,
        publisherFactory: PublisherFactory<any>,
        smsTemplateService: SmsTemplateService,
        private readonly httpService: HttpService,
    ) {
        super(settingService, 'Msg91OTPQueuePublisher', publisherFactory, smsTemplateService);
    }

    async sendSMSSynchronously(message: QueueMessage<any>): Promise<any> {
        const { to, templateId, otp } = message.payload;
        const params = { otp, template_id: templateId, mobile: to, authkey: this.settingService.getConfigValue<SolidCoreSetting>("msg91SmsApiKey") }
        const otpUrl = `${this.settingService.getConfigValue<SolidCoreSetting>("msg91SmsUrl")}/otp?${this.paramsToQueryString(params)}`;
        await this.httpService.axiosRef.post(otpUrl, {});
        this.logger.debug(`Sending OTP to ${to} with url ${otpUrl}`);
    }

    private paramsToQueryString(params: OtpParams): string {
        const qsArray: string[] = []
        const paramKeys = Object.keys(params)
        for (const key of paramKeys) {
            qsArray.push(`${key}=${encodeURIComponent(params[key])}`)
        }
        const qs = qsArray.join("&");
        return qs;
    }
}