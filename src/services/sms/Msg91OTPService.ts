import { HttpService } from "@nestjs/axios";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { Msg91BaseSMSService } from "./Msg91BaseSMSService";
import { OTPQueuePublisher } from "src/jobs/otp-publisher.service";
import { ISMS } from "../../interfaces";

interface OtpParams {
    otp: string,
    template_id: string,
    mobile: string,
    authkey: string
}

@Injectable()
export class Msg91OTPService extends Msg91BaseSMSService implements ISMS {
    constructor(
        @Inject(commonConfig.KEY)
        commonConfiguration: ConfigType<typeof commonConfig>,
        smsPublisher: OTPQueuePublisher,
        smsTemplateService: SmsTemplateService,
        private readonly httpService: HttpService,
    ) {
        super(commonConfiguration, smsPublisher, smsTemplateService)
    }

    async sendSMSSynchronously(message: QueueMessage<any>): Promise<void> {
        const { to, templateId, otp } = message.payload;
        const params = { otp, template_id: templateId, mobile: to, authkey: this.commonConfiguration.msg91Sms.apiKey }
        const otpUrl = `${this.commonConfiguration.msg91Sms.url}/otp?${this.paramsToQueryString(params)}`;
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