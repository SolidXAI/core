import { ConfigType } from '@nestjs/config';
import commonConfig from '../config/common.config';
import { SmsTemplateService } from '../services/sms-template.service';
export declare class SmsTemplateSeederService {
    private readonly smsTemplateService;
    private readonly commonConfiguration;
    private readonly logger;
    constructor(smsTemplateService: SmsTemplateService, commonConfiguration: ConfigType<typeof commonConfig>);
    seed(): Promise<void>;
}
