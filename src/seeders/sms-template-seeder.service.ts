import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigType } from '@nestjs/config';
import commonConfig from '../config/common.config';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { SmsTemplateService } from '../services/sms-template.service';

@Injectable()
export class SmsTemplateSeederService {
    private readonly logger = new Logger(SmsTemplateSeederService.name);

    constructor(
        private readonly smsTemplateService: SmsTemplateService,
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    ) { }

    async seed() {
        // Read the module metadata from a file specified in the .env 
        const seedDataFiles = this.commonConfiguration.smsTemplateSeederFiles.split(',');
        for (let i = 0; i < seedDataFiles.length; i++) {
            const seedDataFile = seedDataFiles[i];
            const fullPath = path.join(process.cwd(), seedDataFile);

            // For each module metadata seed file provided, read contents, parse & convert to a variable. 
            this.logger.log(`Using sms template seed data: ${fullPath}`);
            const smsTemplateJson = fs.readFileSync(fullPath, 'utf-8').toString();
            const smsTemplates: CreateSmsTemplateDto[] = JSON.parse(smsTemplateJson);

            for (let i = 0; i < smsTemplates.length; i++) {
                const smsTemplate = smsTemplates[i];
                this.logger.log(`Found ${smsTemplate.name} sms template`);

                // We need to load the actual template contents. 
                if (smsTemplate.body) {
                    const smsTemplateFilePath = path.join(process.cwd(), smsTemplate.body);
                    smsTemplate.body = fs.readFileSync(smsTemplateFilePath, 'utf-8').toString()
                }

                // Save to DB.
                await this.smsTemplateService.removeByName(smsTemplate.name);
                await this.smsTemplateService.create(smsTemplate);
            }
        }
    }
}