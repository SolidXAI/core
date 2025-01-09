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
exports.SmsTemplateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sms_template_entity_1 = require("../entities/sms-template.entity");
let SmsTemplateService = class SmsTemplateService {
    constructor(smsTemplateRepo, entityManager) {
        this.smsTemplateRepo = smsTemplateRepo;
        this.entityManager = entityManager;
    }
    create(createSmsTemplateDto) {
        const entity = this.smsTemplateRepo.create(createSmsTemplateDto);
        return this.smsTemplateRepo.save(entity);
    }
    async findOneByName(name) {
        const entity = await this.smsTemplateRepo.findOne({
            where: {
                name: name,
            },
        });
        return entity;
    }
    async findAll(paginationQuery) {
        const { limit, offset } = paginationQuery;
        return await this.smsTemplateRepo.find({
            skip: offset,
            take: limit,
        });
    }
    async findOne(id) {
        const entity = await this.smsTemplateRepo.findOne({
            where: {
                id: id,
            },
        });
        if (!entity) {
            throw new common_1.NotFoundException(`Sms template #${id} not found`);
        }
        return entity;
    }
    async update(id, updateSmsTemplateDto) {
        const entity = await this.smsTemplateRepo.preload({
            id,
            ...updateSmsTemplateDto,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`Sms template #${id} not found`);
        }
        return this.smsTemplateRepo.save(entity);
    }
    async removeByName(name) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.smsTemplateRepo.remove(entity);
        }
    }
    async remove(id) {
        const entity = await this.findOne(id);
        return this.smsTemplateRepo.remove(entity);
    }
};
exports.SmsTemplateService = SmsTemplateService;
exports.SmsTemplateService = SmsTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sms_template_entity_1.SmsTemplate)),
    __param(1, (0, typeorm_1.InjectEntityManager)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.EntityManager])
], SmsTemplateService);
//# sourceMappingURL=sms-template.service.js.map