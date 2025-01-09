import { Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import commonConfig from "src/config/common.config";
import { QueueMessage } from "src/interfaces/mq";
import { SmsTemplateService } from "../sms-template.service";
import { RabbitMqPublisher } from "src/services/rabbitmq-publisher.service";
import { ISMS } from "../../interfaces";
export declare abstract class Msg91BaseSMSService implements ISMS {
    protected readonly commonConfiguration: ConfigType<typeof commonConfig>;
    protected readonly smsPublisher: RabbitMqPublisher<any>;
    protected readonly smsTemplateService: SmsTemplateService;
    protected readonly logger: Logger;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, smsPublisher: RabbitMqPublisher<any>, smsTemplateService: SmsTemplateService);
    sendSMS(_to: string, _body: string, _shouldQueueSms: boolean): Promise<void>;
    sendSMSUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueSms?: boolean): Promise<void>;
    sendSMSAsynchronously(message: any): Promise<void>;
    abstract sendSMSSynchronously(message: QueueMessage<any>): Promise<void>;
}
