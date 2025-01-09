"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Msg91BaseSMSService = void 0;
const common_1 = require("@nestjs/common");
const handlebars_1 = require("handlebars");
class Msg91BaseSMSService {
    constructor(commonConfiguration, smsPublisher, smsTemplateService) {
        this.commonConfiguration = commonConfiguration;
        this.smsPublisher = smsPublisher;
        this.smsTemplateService = smsTemplateService;
        this.logger = new common_1.Logger(Msg91BaseSMSService.name);
    }
    sendSMS(_to, _body, _shouldQueueSms) {
        throw new Error(`Msg91 does not support sending plain text messages, you need to register a template and use the templateId to send the SMS.`);
    }
    async sendSMSUsingTemplate(to, templateName, templateParams, shouldQueueSms = false) {
        const emailTemplate = await this.smsTemplateService.findOneByName(templateName);
        if (!emailTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }
        let body = null;
        let templateId = null;
        if (emailTemplate.body) {
            const bodyTemplate = handlebars_1.default.compile(emailTemplate.body);
            body = bodyTemplate(templateParams);
        }
        if (emailTemplate.smsProviderTemplateId) {
            templateId = emailTemplate.smsProviderTemplateId;
        }
        if (!body && !templateId) {
            throw new Error(`Invalid template, neither body nor templateId specified on template with name ${templateName}`);
        }
        const message = {
            payload: {
                ...templateParams,
                to: to,
                templateId: templateId,
            },
        };
        if (shouldQueueSms === true) {
            await this.sendSMSAsynchronously(message);
        }
        else if (shouldQueueSms === false && this.commonConfiguration.shouldQueueSms === true) {
            await this.sendSMSAsynchronously(message);
        }
        else {
            await this.sendSMSSynchronously(message);
        }
    }
    async sendSMSAsynchronously(message) {
        const { to } = message.payload;
        this.smsPublisher.publish(message);
        this.logger.debug(`Queueing SMS to ${to} with message ${JSON.stringify(message)}`);
    }
}
exports.Msg91BaseSMSService = Msg91BaseSMSService;
//# sourceMappingURL=Msg91BaseSMSService.js.map