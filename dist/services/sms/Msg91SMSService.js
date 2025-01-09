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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Msg91SMSService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const common_config_1 = require("../../config/common.config");
const sms_publisher_service_1 = require("../../jobs/sms-publisher.service");
const sms_template_service_1 = require("../sms-template.service");
const Msg91BaseSMSService_1 = require("./Msg91BaseSMSService");
let Msg91SMSService = class Msg91SMSService extends Msg91BaseSMSService_1.Msg91BaseSMSService {
    constructor(commonConfiguration, smsPublisher, smsTemplateService, httpService) {
        super(commonConfiguration, smsPublisher, smsTemplateService);
        this.httpService = httpService;
    }
    async sendSMSSynchronously(message) {
        const { to, templateId, ...templateParams } = message.payload;
        const body = { template_id: templateId, short_url: "0", recipients: [{ mobiles: to, ...templateParams }] };
        const headers = { "authkey": this.commonConfiguration.msg91Sms.apiKey };
        await this.httpService.axiosRef.post(`${this.commonConfiguration.msg91Sms.url}/flow`, body, { headers });
        this.logger.debug(`Sending SMS to ${to} with body ${JSON.stringify(body)} and headers ${JSON.stringify(headers)}`);
    }
};
exports.Msg91SMSService = Msg91SMSService;
exports.Msg91SMSService = Msg91SMSService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0, sms_publisher_service_1.SmsQueuePublisher,
        sms_template_service_1.SmsTemplateService,
        axios_1.HttpService])
], Msg91SMSService);
//# sourceMappingURL=Msg91SMSService.js.map