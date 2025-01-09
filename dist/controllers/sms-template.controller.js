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
exports.SmsTemplateController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const pagination_query_dto_1 = require("../dtos/pagination-query.dto");
const roles_decorator_1 = require("../decorators/roles.decorator");
const sms_template_service_1 = require("../services/sms-template.service");
const create_sms_template_dto_1 = require("../dtos/create-sms-template.dto");
const update_sms_template_dto_1 = require("../dtos/update-sms-template.dto");
let SmsTemplateController = class SmsTemplateController {
    constructor(smsTemplateService) {
        this.smsTemplateService = smsTemplateService;
    }
    create(dto) {
        return this.smsTemplateService.create(dto);
    }
    findAll(paginationQuery) {
        return this.smsTemplateService.findAll(paginationQuery);
    }
    findOne(id) {
        return this.smsTemplateService.findOne(+id);
    }
    update(id, dto) {
        return this.smsTemplateService.update(+id, dto);
    }
    remove(id) {
        return this.smsTemplateService.remove(+id);
    }
};
exports.SmsTemplateController = SmsTemplateController;
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: require("../entities/sms-template.entity").SmsTemplate }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_sms_template_dto_1.CreateSmsTemplateDto]),
    __metadata("design:returntype", void 0)
], SmsTemplateController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number }),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [require("../entities/sms-template.entity").SmsTemplate] }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], SmsTemplateController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, roles_decorator_1.Roles)('Admin'),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/sms-template.entity").SmsTemplate }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SmsTemplateController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Patch)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/sms-template.entity").SmsTemplate }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_sms_template_dto_1.UpdateSmsTemplateDto]),
    __metadata("design:returntype", void 0)
], SmsTemplateController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Delete)(':id'),
    openapi.ApiResponse({ status: 200, type: require("../entities/sms-template.entity").SmsTemplate }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SmsTemplateController.prototype, "remove", null);
exports.SmsTemplateController = SmsTemplateController = __decorate([
    (0, common_1.Controller)('sms-templates'),
    (0, swagger_1.ApiTags)("Common"),
    __metadata("design:paramtypes", [sms_template_service_1.SmsTemplateService])
], SmsTemplateController);
//# sourceMappingURL=sms-template.controller.js.map