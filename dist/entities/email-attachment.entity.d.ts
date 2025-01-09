import { CommonEntity } from "./common.entity";
import { EmailTemplate } from "./email-template.entity";
export declare class EmailAttachment extends CommonEntity {
    name: string;
    displayName: string;
    relativePath: string;
    url: string;
    template: string;
    emailTemplate: EmailTemplate;
}
