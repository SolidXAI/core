import { CommonEntity } from 'src/entities/common.entity';
import { EmailAttachment } from './email-attachment.entity';
export declare class EmailTemplate extends CommonEntity {
    name: string;
    displayName: string;
    body: string;
    subject: string;
    description: string;
    active: boolean;
    attachments: EmailAttachment[];
}
