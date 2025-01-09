import { CreateEmailAttachmentDto } from './create-email-attachment.dto';
export declare class CreateEmailTemplateDto {
    name: string;
    displayName: string;
    body: string;
    subject: string;
    description: string;
    active: boolean;
    attachments: CreateEmailAttachmentDto[];
}
