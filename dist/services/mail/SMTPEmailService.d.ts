import { ConfigType } from '@nestjs/config';
import { QueueMessage } from 'src/interfaces/mq';
import { EmailQueuePublisher } from 'src/jobs/email-publisher.service';
import commonConfig from 'src/config/common.config';
import { EmailTemplateService } from '../email-template.service';
import { IMail } from "../../interfaces";
export declare class SMTPEMailService implements IMail {
    private readonly commonConfiguration;
    private readonly emailPublisher;
    private readonly emailTemplateService;
    private readonly logger;
    private readonly transporter;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, emailPublisher: EmailQueuePublisher, emailTemplateService: EmailTemplateService);
    sendEmailUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueEmails?: boolean, parentEntity?: any, parentEntityId?: any): Promise<void>;
    sendEmail(to: string, subject: string, body: string, shouldQueueEmails?: boolean, parentEntity?: any, parentEntityId?: any): Promise<void>;
    sendEmailAsynchronously(message: any): Promise<void>;
    sendEmailSynchronously(message: QueueMessage<any>): Promise<void>;
}
