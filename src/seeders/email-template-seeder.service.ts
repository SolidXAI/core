import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigType } from '@nestjs/config';
import { EmailTemplateService } from '../services/email-template.service';
import commonConfig from '../config/common.config';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';

@Injectable()
export class EmailTemplateSeederService {
    private readonly logger = new Logger(EmailTemplateSeederService.name);

    constructor(
        private readonly emailTemplateService: EmailTemplateService,
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    ) { }

    async seed() {
        // Read the module metadata from a file specified in the .env 
        const seedDataFiles = this.commonConfiguration.emailTemplateSeederFiles.split(',');
        for (let i = 0; i < seedDataFiles.length; i++) {
            const seedDataFile = seedDataFiles[i];
            const fullPath = path.join(process.cwd(), seedDataFile);

            // For each module metadata seed file provided, read contents, parse & convert to a variable. 
            this.logger.log(`Using email template seed data: ${fullPath}`);
            const emailTemplateJson = fs.readFileSync(fullPath, 'utf-8').toString();
            const emailTemplates: CreateEmailTemplateDto[] = JSON.parse(emailTemplateJson);

            for (let i = 0; i < emailTemplates.length; i++) {
                const emailTemplate = emailTemplates[i];
                this.logger.log(`Found ${emailTemplate.name} email template`);

                // We need to load the actual template contents. 
                const emailTemplateFilePath = path.join(process.cwd(), emailTemplate.body);
                emailTemplate.body = fs.readFileSync(emailTemplateFilePath, 'utf-8').toString()

                // Save to DB.
                await this.emailTemplateService.removeByName(emailTemplate.name);
                await this.emailTemplateService.create(emailTemplate);
            }

        }
    }
}