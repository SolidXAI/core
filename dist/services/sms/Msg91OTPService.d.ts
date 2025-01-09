import { HttpService } from "@nestjs/axios";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { Msg91BaseSMSService } from "./Msg91BaseSMSService";
import { OTPQueuePublisher } from "src/jobs/otp-publisher.service";
import { ISMS } from "../../interfaces";
export declare class Msg91OTPService extends Msg91BaseSMSService implements ISMS {
    private readonly httpService;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, smsPublisher: OTPQueuePublisher, smsTemplateService: SmsTemplateService, httpService: HttpService);
    sendSMSSynchronously(message: QueueMessage<any>): Promise<void>;
    private paramsToQueryString;
}
