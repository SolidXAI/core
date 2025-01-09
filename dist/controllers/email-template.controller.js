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
exports.EmailTemplateController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const pagination_query_dto_1 = require("../dtos/pagination-query.dto");
const roles_decorator_1 = require("../decorators/roles.decorator");
const email_template_service_1 = require("../services/email-template.service");
const create_email_template_dto_1 = require("../dtos/create-email-template.dto");
const update_email_template_dto_1 = require("../dtos/update-email-template.dto");
const public_decorator_1 = require("../decorators/public.decorator");
const Mailgen = require("mailgen");
let EmailTemplateController = class EmailTemplateController {
    constructor(emailTemplateService) {
        this.emailTemplateService = emailTemplateService;
    }
    create(dto) {
        return this.emailTemplateService.create(dto);
    }
    findAll(paginationQuery) {
        return this.emailTemplateService.findAll(paginationQuery);
    }
    findOne(id) {
        return this.emailTemplateService.findOne(+id);
    }
    update(id, dto) {
        return this.emailTemplateService.update(+id, dto);
    }
    remove(id) {
        return this.emailTemplateService.remove(+id);
    }
    generateMailgenTemplate(templateType) {
        const appName = process.env.SOLID_APP_NAME;
        const appUrl = process.env.SOLID_APP_WEBSITE_URL;
        var mailGenerator = new Mailgen({
            theme: 'default',
            product: {
                name: appName,
                link: appUrl
            }
        });
        let email = null;
        if (templateType === 'otp-on-register') {
            email = {
                body: {
                    name: 'John Appleseed',
                    intro: `Welcome to ${appName}! We\'re very excited to have you on board.`,
                    action: {
                        instructions: `To get started with ${appName}, please verify your account using the below verification code.`,
                        button: {
                            color: '#22BC66',
                            text: `321455`,
                            link: null
                        }
                    },
                    outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
                }
            };
        }
        if (templateType === 'otp-on-login') {
            email = {
                body: {
                    name: 'John Appleseed',
                    intro: `Welcome to ${appName}!`,
                    action: {
                        instructions: `Login to ${appName}, using the below verification code.`,
                        button: {
                            color: '#22BC66',
                            text: `321455`,
                            link: null
                        }
                    },
                    outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
                }
            };
        }
        if (templateType === 'forgot-password') {
            email = {
                body: {
                    name: 'John Appleseed',
                    intro: `Welcome to ${appName}!`,
                    action: {
                        instructions: `Click on the below link to reset your password. Please note that this link will expire in 10 minutes.`,
                        button: {
                            color: '#22BC66',
                            text: `Reset Password`,
                            link: `https://example.com`
                        }
                    },
                    outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
                }
            };
        }
        var emailBody = mailGenerator.generate(email);
        return emailBody;
    }
};
exports.EmailTemplateController = EmailTemplateController;
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: require("../entities/email-template.entity").EmailTemplate }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_email_template_dto_1.CreateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], EmailTemplateController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [require("../entities/email-template.entity").EmailTemplate] }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], EmailTemplateController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/email-template.entity").EmailTemplate }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmailTemplateController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/email-template.entity").EmailTemplate }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_email_template_dto_1.UpdateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], EmailTemplateController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/email-template.entity").EmailTemplate }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmailTemplateController.prototype, "remove", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('mailgen-template/:templateType'),
    (0, common_1.Header)('content-type', 'text/html'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('templateType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmailTemplateController.prototype, "generateMailgenTemplate", null);
exports.EmailTemplateController = EmailTemplateController = __decorate([
    (0, common_1.Controller)('email-templates'),
    (0, swagger_1.ApiTags)("Common"),
    __metadata("design:paramtypes", [email_template_service_1.EmailTemplateService])
], EmailTemplateController);
//# sourceMappingURL=email-template.controller.js.map