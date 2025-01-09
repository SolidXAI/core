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
var Msg91WhatsappService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Msg91WhatsappService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const common_config_1 = require("../../config/common.config");
const whatsapp_publisher_service_1 = require("../../jobs/whatsapp-publisher.service");
const sms_template_service_1 = require("../sms-template.service");
const Msg91BaseSMSService_1 = require("../sms/Msg91BaseSMSService");
var Msg91WhatsappParameterHeaderType;
(function (Msg91WhatsappParameterHeaderType) {
    Msg91WhatsappParameterHeaderType[Msg91WhatsappParameterHeaderType["image"] = 0] = "image";
    Msg91WhatsappParameterHeaderType[Msg91WhatsappParameterHeaderType["text"] = 1] = "text";
})(Msg91WhatsappParameterHeaderType || (Msg91WhatsappParameterHeaderType = {}));
let Msg91WhatsappService = Msg91WhatsappService_1 = class Msg91WhatsappService extends Msg91BaseSMSService_1.Msg91BaseSMSService {
    constructor(commonConfiguration, whatsappPublisher, smsTemplateService, httpService) {
        super(commonConfiguration, whatsappPublisher, smsTemplateService);
        this.httpService = httpService;
        this.logger = new common_1.Logger(Msg91WhatsappService_1.name);
    }
    async sendSMSSynchronously(message) {
        const body = this.createWhatsappRequest(message);
        const headers = { authkey: this.commonConfiguration.msg91Whatsapp.apiKey };
        await this.httpService.axiosRef.post(`${this.commonConfiguration.msg91Whatsapp.url}`, body, { headers });
        this.logger.debug(`Sending Whatsapp message for CP registration with body ${JSON.stringify(body)} and url ${this.commonConfiguration.msg91Whatsapp.url}`);
    }
    createWhatsappRequest(message) {
        const { to, templateId, ...parameters } = message.payload;
        const whatsappToAndComponents = this.createWhatsappToAndComponents(to, parameters);
        const whatsappLanguage = {
            code: 'en',
            policy: 'deterministic',
        };
        const whatsappTemplate = this.createWhatsappTemplate(templateId, whatsappToAndComponents, whatsappLanguage);
        const whatsappPayload = {
            messaging_product: 'whatsapp',
            type: 'template',
            template: whatsappTemplate,
        };
        return {
            integrated_number: this.commonConfiguration.msg91Whatsapp.integratedNumber,
            content_type: 'template',
            payload: whatsappPayload,
        };
    }
    createWhatsappToAndComponents(to, parameters) {
        return {
            to: [to],
            components: this.createWhatsappComponents(parameters),
        };
    }
    createWhatsappComponents(parameters) {
        const components = {};
        if (parameters.header) {
            components['header_1'] = {
                type: parameters.header.type,
                value: parameters.header.value,
            };
        }
        if (parameters.body && parameters.body.length > 0) {
            parameters.body.forEach((elem, index) => {
                components[`body_${index + 1}`] = {
                    type: 'text',
                    value: elem,
                };
            });
        }
        return components;
    }
    createWhatsappTemplate(templateName, toAndComponents, language) {
        return {
            name: templateName,
            language: language,
            namespace: null,
            to_and_components: [toAndComponents],
        };
    }
};
exports.Msg91WhatsappService = Msg91WhatsappService;
exports.Msg91WhatsappService = Msg91WhatsappService = Msg91WhatsappService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0, whatsapp_publisher_service_1.WhatsappQueuePublisher,
        sms_template_service_1.SmsTemplateService,
        axios_1.HttpService])
], Msg91WhatsappService);
//# sourceMappingURL=Msg91WhatsappService.js.map