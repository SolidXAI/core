"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EmailTemplateSeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplateSeederService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
const email_template_service_1 = require("../services/email-template.service");
const common_config_1 = require("../config/common.config");
let EmailTemplateSeederService = EmailTemplateSeederService_1 = class EmailTemplateSeederService {
    constructor(emailTemplateService, commonConfiguration) {
        this.emailTemplateService = emailTemplateService;
        this.commonConfiguration = commonConfiguration;
        this.logger = new common_1.Logger(EmailTemplateSeederService_1.name);
    }
    async seed() {
        const seedDataFiles = this.commonConfiguration.emailTemplateSeederFiles.split(',');
        for (let i = 0; i < seedDataFiles.length; i++) {
            const seedDataFile = seedDataFiles[i];
            const fullPath = path.join(process.cwd(), seedDataFile);
            this.logger.log(`Using email template seed data: ${fullPath}`);
            const emailTemplateJson = fs.readFileSync(fullPath, 'utf-8').toString();
            const emailTemplates = JSON.parse(emailTemplateJson);
            for (let i = 0; i < emailTemplates.length; i++) {
                const emailTemplate = emailTemplates[i];
                this.logger.log(`Found ${emailTemplate.name} email template`);
                const emailTemplateFilePath = path.join(process.cwd(), emailTemplate.body);
                emailTemplate.body = fs.readFileSync(emailTemplateFilePath, 'utf-8').toString();
                await this.emailTemplateService.removeByName(emailTemplate.name);
                await this.emailTemplateService.create(emailTemplate);
            }
        }
    }
};
exports.EmailTemplateSeederService = EmailTemplateSeederService;
exports.EmailTemplateSeederService = EmailTemplateSeederService = EmailTemplateSeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [email_template_service_1.EmailTemplateService, void 0])
], EmailTemplateSeederService);
//# sourceMappingURL=email-template-seeder.service.js.map