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
var SmsTemplateSeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsTemplateSeederService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
const common_config_1 = require("../config/common.config");
const sms_template_service_1 = require("../services/sms-template.service");
let SmsTemplateSeederService = SmsTemplateSeederService_1 = class SmsTemplateSeederService {
    constructor(smsTemplateService, commonConfiguration) {
        this.smsTemplateService = smsTemplateService;
        this.commonConfiguration = commonConfiguration;
        this.logger = new common_1.Logger(SmsTemplateSeederService_1.name);
    }
    async seed() {
        const seedDataFiles = this.commonConfiguration.smsTemplateSeederFiles.split(',');
        for (let i = 0; i < seedDataFiles.length; i++) {
            const seedDataFile = seedDataFiles[i];
            const fullPath = path.join(process.cwd(), seedDataFile);
            this.logger.log(`Using sms template seed data: ${fullPath}`);
            const smsTemplateJson = fs.readFileSync(fullPath, 'utf-8').toString();
            const smsTemplates = JSON.parse(smsTemplateJson);
            for (let i = 0; i < smsTemplates.length; i++) {
                const smsTemplate = smsTemplates[i];
                this.logger.log(`Found ${smsTemplate.name} sms template`);
                if (smsTemplate.body) {
                    const smsTemplateFilePath = path.join(process.cwd(), smsTemplate.body);
                    smsTemplate.body = fs.readFileSync(smsTemplateFilePath, 'utf-8').toString();
                }
                await this.smsTemplateService.removeByName(smsTemplate.name);
                await this.smsTemplateService.create(smsTemplate);
            }
        }
    }
};
exports.SmsTemplateSeederService = SmsTemplateSeederService;
exports.SmsTemplateSeederService = SmsTemplateSeederService = SmsTemplateSeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [sms_template_service_1.SmsTemplateService, void 0])
], SmsTemplateSeederService);
//# sourceMappingURL=sms-template-seeder.service.js.map