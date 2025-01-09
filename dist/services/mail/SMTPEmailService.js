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
var SMTPEMailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMTPEMailService = void 0;
const common_1 = require("@nestjs/common");
const email_publisher_service_1 = require("../../jobs/email-publisher.service");
const common_config_1 = require("../../config/common.config");
const email_template_service_1 = require("../email-template.service");
const handlebars_1 = require("handlebars");
const nodemailer = require("nodemailer");
let SMTPEMailService = SMTPEMailService_1 = class SMTPEMailService {
    constructor(commonConfiguration, emailPublisher, emailTemplateService) {
        this.commonConfiguration = commonConfiguration;
        this.emailPublisher = emailPublisher;
        this.emailTemplateService = emailTemplateService;
        this.logger = new common_1.Logger(SMTPEMailService_1.name);
        this.transporter = nodemailer.createTransport({
            host: this.commonConfiguration.smtpMail.host,
            port: this.commonConfiguration.smtpMail.port,
            secure: this.commonConfiguration.smtpMail.port === 465,
            auth: {
                user: this.commonConfiguration.smtpMail.username,
                pass: this.commonConfiguration.smtpMail.password
            }
        });
    }
    async sendEmailUsingTemplate(to, templateName, templateParams, shouldQueueEmails = false, parentEntity = null, parentEntityId = null) {
        const emailTemplate = await this.emailTemplateService.findOneByName(templateName);
        if (!emailTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }
        const bodyTemplate = handlebars_1.default.compile(emailTemplate.body);
        const body = bodyTemplate(templateParams);
        const subjectTemplate = handlebars_1.default.compile(emailTemplate.subject);
        const subject = subjectTemplate(templateParams);
        await this.sendEmail(to, subject, body, shouldQueueEmails, parentEntity, parentEntityId);
    }
    async sendEmail(to, subject, body, shouldQueueEmails = false, parentEntity = null, parentEntityId = null) {
        const message = {
            payload: {
                from: this.commonConfiguration.smtpMail.from,
                to: to,
                subject: subject,
                body: body
            },
            parentEntity: parentEntity,
            parentEntityId: parentEntityId,
        };
        if (shouldQueueEmails === true) {
            this.sendEmailAsynchronously(message);
        }
        else if (shouldQueueEmails == false && this.commonConfiguration.shouldQueueEmails === true) {
            this.sendEmailAsynchronously(message);
        }
        else {
            await this.sendEmailSynchronously(message);
        }
    }
    async sendEmailAsynchronously(message) {
        const { to, subject, body } = message.payload;
        this.emailPublisher.publish(message);
        this.logger.debug(`Queueing email to ${to} with subject ${subject} and body ${body}`);
    }
    async sendEmailSynchronously(message) {
        const { from, to, subject, body } = message.payload;
        const r = await this.transporter.sendMail({
            from: from,
            to: to,
            subject: subject,
            html: body
        });
        this.logger.debug(`Sending email to ${to} with subject ${subject}`);
        return r;
    }
};
exports.SMTPEMailService = SMTPEMailService;
exports.SMTPEMailService = SMTPEMailService = SMTPEMailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0, email_publisher_service_1.EmailQueuePublisher,
        email_template_service_1.EmailTemplateService])
], SMTPEMailService);
//# sourceMappingURL=SMTPEmailService.js.map