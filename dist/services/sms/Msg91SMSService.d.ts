import { HttpService } from "@nestjs/axios";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { SmsQueuePublisher } from "src/jobs/sms-publisher.service";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { Msg91BaseSMSService } from "./Msg91BaseSMSService";
import { ISMS } from "../../interfaces";
export declare class Msg91SMSService extends Msg91BaseSMSService implements ISMS {
    private readonly httpService;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, smsPublisher: SmsQueuePublisher, smsTemplateService: SmsTemplateService, httpService: HttpService);
    sendSMSSynchronously(message: QueueMessage<any>): Promise<void>;
}
