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
exports.Msg91OTPService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const common_config_1 = require("../../config/common.config");
const sms_template_service_1 = require("../sms-template.service");
const Msg91BaseSMSService_1 = require("./Msg91BaseSMSService");
const otp_publisher_service_1 = require("../../jobs/otp-publisher.service");
let Msg91OTPService = class Msg91OTPService extends Msg91BaseSMSService_1.Msg91BaseSMSService {
    constructor(commonConfiguration, smsPublisher, smsTemplateService, httpService) {
        super(commonConfiguration, smsPublisher, smsTemplateService);
        this.httpService = httpService;
    }
    async sendSMSSynchronously(message) {
        const { to, templateId, otp } = message.payload;
        const params = { otp, template_id: templateId, mobile: to, authkey: this.commonConfiguration.msg91Sms.apiKey };
        const otpUrl = `${this.commonConfiguration.msg91Sms.url}/otp?${this.paramsToQueryString(params)}`;
        await this.httpService.axiosRef.post(otpUrl, {});
        this.logger.debug(`Sending OTP to ${to} with url ${otpUrl}`);
    }
    paramsToQueryString(params) {
        const qsArray = [];
        const paramKeys = Object.keys(params);
        for (const key of paramKeys) {
            qsArray.push(`${key}=${encodeURIComponent(params[key])}`);
        }
        const qs = qsArray.join("&");
        return qs;
    }
};
exports.Msg91OTPService = Msg91OTPService;
exports.Msg91OTPService = Msg91OTPService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0, otp_publisher_service_1.OTPQueuePublisher,
        sms_template_service_1.SmsTemplateService,
        axios_1.HttpService])
], Msg91OTPService);
//# sourceMappingURL=Msg91OTPService.js.map