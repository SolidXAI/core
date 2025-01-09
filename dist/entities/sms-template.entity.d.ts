import { CommonEntity } from 'src/entities/common.entity';
export declare class SmsTemplate extends CommonEntity {
    name: string;
    displayName: string;
    body: string;
    smsProviderTemplateId: string;
    description: string;
    active: boolean;
}
