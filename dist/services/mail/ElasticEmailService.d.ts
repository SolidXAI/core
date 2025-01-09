import { ConfigType } from '@nestjs/config';
import commonConfig from 'src/config/common.config';
import { ApiEmailQueuePublisher } from 'src/jobs/api-email-publisher.service';
import { QueueMessage } from 'src/interfaces/mq';
import { EmailTemplateService } from '../email-template.service';
import { PdfService } from '../pdf.service';
import { FileService } from '../file.service';
import { IMail, MailAttachmentWrapper } from "../../interfaces";
export declare class ElasticEmailService implements IMail {
    private readonly commonConfiguration;
    private readonly emailPublisher;
    private readonly emailTemplateService;
    private readonly pdfService;
    private readonly fileService;
    private readonly logger;
    private readonly emailsApi;
    constructor(commonConfiguration: ConfigType<typeof commonConfig>, emailPublisher: ApiEmailQueuePublisher, emailTemplateService: EmailTemplateService, pdfService: PdfService, fileService: FileService);
    sendEmailUsingTemplate(to: string, templateName: string, templateParams: any, shouldQueueEmails?: boolean, parentEntity?: any, parentEntityId?: any): Promise<void>;
    sendEmail(to: string, subject: string, body: string, shouldQueueEmails?: boolean, parentEntity?: any, parentEntityId?: any, wrapperAttachments?: MailAttachmentWrapper[]): Promise<void>;
    sendEmailAsynchronously(message: QueueMessage<any>): Promise<void>;
    sendEmailSynchronously(message: QueueMessage<any>): Promise<void>;
    private toAttachmentWrapper;
    private toMessageAttachment;
    private getAttachmentAsPDF;
}
