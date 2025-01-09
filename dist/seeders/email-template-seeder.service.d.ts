import { ConfigType } from '@nestjs/config';
import { EmailTemplateService } from '../services/email-template.service';
import commonConfig from '../config/common.config';
export declare class EmailTemplateSeederService {
    private readonly emailTemplateService;
    private readonly commonConfiguration;
    private readonly logger;
    constructor(emailTemplateService: EmailTemplateService, commonConfiguration: ConfigType<typeof commonConfig>);
    seed(): Promise<void>;
}
