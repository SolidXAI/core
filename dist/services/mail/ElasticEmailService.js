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
var ElasticEmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticEmailService = void 0;
const common_1 = require("@nestjs/common");
const handlebars_1 = require("handlebars");
const common_config_1 = require("../../config/common.config");
const api_email_publisher_service_1 = require("../../jobs/api-email-publisher.service");
const email_template_service_1 = require("../email-template.service");
const pdf_service_1 = require("../pdf.service");
const file_service_1 = require("../file.service");
const ElasticEmail = require('@elasticemail/elasticemail-client');
let ElasticEmailService = ElasticEmailService_1 = class ElasticEmailService {
    constructor(commonConfiguration, emailPublisher, emailTemplateService, pdfService, fileService) {
        this.commonConfiguration = commonConfiguration;
        this.emailPublisher = emailPublisher;
        this.emailTemplateService = emailTemplateService;
        this.pdfService = pdfService;
        this.fileService = fileService;
        this.logger = new common_1.Logger(ElasticEmailService_1.name);
        const client = ElasticEmail.ApiClient.instance;
        const apikey = client.authentications['apikey'];
        apikey.apiKey = commonConfiguration.apiMail.key;
        this.emailsApi = new ElasticEmail.EmailsApi();
    }
    async sendEmailUsingTemplate(to, templateName, templateParams, shouldQueueEmails = false, parentEntity = null, parentEntityId = null) {
        const emailTemplate = await this.emailTemplateService.findOneByName(templateName, { attachments: true });
        if (!emailTemplate) {
            throw new Error(`Invalid template name ${templateName}`);
        }
        const bodyTemplate = handlebars_1.default.compile(emailTemplate.body);
        const body = bodyTemplate(templateParams);
        const subjectTemplate = handlebars_1.default.compile(emailTemplate.subject);
        const subject = subjectTemplate(templateParams);
        const emailTemplateAttachments = emailTemplate.attachments;
        const attachmentWrappers = [];
        for (const attachment of emailTemplateAttachments) {
            const attachmentWrapper = await this.toAttachmentWrapper(attachment, templateParams);
            attachmentWrappers.push(attachmentWrapper);
        }
        await this.sendEmail(to, subject, body, shouldQueueEmails, parentEntity, parentEntityId, attachmentWrappers);
    }
    async sendEmail(to, subject, body, shouldQueueEmails = false, parentEntity = null, parentEntityId = null, wrapperAttachments = []) {
        const message = {
            payload: {
                from: this.commonConfiguration.smtpMail.from,
                to: to,
                subject: subject,
                body: body,
                wrapperAttachments: wrapperAttachments,
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
        const { from, to, subject, body, wrapperAttachments } = message.payload;
        const emailData = {
            Recipients: {
                To: [to]
            },
            Content: {
                Body: [
                    {
                        ContentType: "HTML",
                        Charset: "utf-8",
                        Content: body
                    }
                ],
                From: from,
                Subject: subject
            }
        };
        const relativeAttachments = wrapperAttachments.filter(wrapperAttachment => wrapperAttachment.relativePath);
        if (relativeAttachments.length > 0) {
            emailData.Content['AttachFiles'] = relativeAttachments.map(attachment => attachment.relativePath);
        }
        const binaryAttachments = wrapperAttachments.filter(wrapperAttachment => wrapperAttachment.attachment);
        if (binaryAttachments.length > 0) {
            const attachments = [];
            for (const wrapperAttachment of binaryAttachments) {
                const attachment = await this.toMessageAttachment(wrapperAttachment.attachment, wrapperAttachment.attachment.templateParams);
                attachments.push(attachment);
            }
            emailData.Content['Attachments'] = attachments;
        }
        const callback = (error, _data, _response) => {
            if (error) {
                this.logger.debug(`Error while sending email to ${to} with subject ${subject}`, error);
            }
            else {
                this.logger.debug(`Sending email to ${to} with subject ${subject}`);
            }
        };
        this.emailsApi.emailsTransactionalPost(emailData, callback);
    }
    async toAttachmentWrapper(attachment, templateParams) {
        const attachmentWrapper = {};
        if (attachment.template) {
            attachmentWrapper.attachment = {
                filename: attachment.displayName,
                templatePath: attachment.template,
                templateParams: templateParams,
            };
        }
        else {
            attachmentWrapper.relativePath = attachment.relativePath;
        }
        return attachmentWrapper;
    }
    async toMessageAttachment(attachment, templateParams) {
        const attachmentContent = await this.getAttachmentAsPDF(attachment.templatePath, templateParams);
        return {
            "BinaryContent": attachmentContent.toString('base64'),
            "Name": attachment.filename,
        };
    }
    async getAttachmentAsPDF(attachmentTemplatePath, templateParams) {
        const template = await this.fileService.readFile(attachmentTemplatePath);
        const bodyTemplate = handlebars_1.default.compile(template);
        const html = bodyTemplate(templateParams);
        const pdfBuffer = await this.pdfService.generatePdf(html);
        const buffer = Buffer.from(pdfBuffer);
        return buffer;
    }
};
exports.ElasticEmailService = ElasticEmailService;
exports.ElasticEmailService = ElasticEmailService = ElasticEmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(common_config_1.default.KEY)),
    __metadata("design:paramtypes", [void 0, api_email_publisher_service_1.ApiEmailQueuePublisher,
        email_template_service_1.EmailTemplateService,
        pdf_service_1.PdfService,
        file_service_1.FileService])
], ElasticEmailService);
//# sourceMappingURL=ElasticEmailService.js.map