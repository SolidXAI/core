import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import commonConfig from 'src/config/common.config';
import { WhatsappQueuePublisher } from 'src/jobs/whatsapp-publisher.service';
import { QueueMessage } from 'src/interfaces/mq';
import { SmsTemplateService } from '../sms-template.service';
import { Msg91BaseSMSService } from '../sms/Msg91BaseSMSService';
import { ISMS } from "../../interfaces";
declare enum Msg91WhatsappParameterHeaderType {
    image = 0,
    text = 1
}
export interface Msg91WhatsappParameter {
    header?: {
        type: Msg91WhatsappParameterHeaderType;
        value: string;
    };
    body: string[];
}
export declare class Msg91WhatsappService extends Msg91BaseSMSService implements ISMS {
    private readonly httpService;
    readonly logger: Logger;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, whatsappPublisher: WhatsappQueuePublisher, smsTemplateService: SmsTemplateService, httpService: HttpService);
    sendSMSSynchronously(message: QueueMessage<any>): Promise<void>;
    private createWhatsappRequest;
    private createWhatsappToAndComponents;
    private createWhatsappComponents;
    private createWhatsappTemplate;
}
export {};
