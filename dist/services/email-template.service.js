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
exports.EmailTemplateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const email_template_entity_1 = require("../entities/email-template.entity");
let EmailTemplateService = class EmailTemplateService {
    constructor(emailTemplateRepo, entityManager) {
        this.emailTemplateRepo = emailTemplateRepo;
        this.entityManager = entityManager;
    }
    create(createEmailTemplateDto) {
        const entity = this.emailTemplateRepo.create(createEmailTemplateDto);
        return this.emailTemplateRepo.save(entity);
    }
    async findAll(paginationQuery) {
        const { limit, offset } = paginationQuery;
        return await this.emailTemplateRepo.find({
            skip: offset,
            take: limit,
        });
    }
    async findOneByName(name, relations = {}) {
        const entity = await this.emailTemplateRepo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return entity;
    }
    async findOne(id) {
        const entity = await this.emailTemplateRepo.findOne({
            where: {
                id: id,
            },
        });
        if (!entity) {
            throw new common_1.NotFoundException(`Email template #${id} not found`);
        }
        return entity;
    }
    async update(id, updateEmailTemplateDto) {
        const t = {
            id,
            ...updateEmailTemplateDto,
        };
        const entity = await this.emailTemplateRepo.preload(t);
        if (!entity) {
            throw new common_1.NotFoundException(`Email template #${id} not found`);
        }
        return this.emailTemplateRepo.save(entity);
    }
    async removeByName(name) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.emailTemplateRepo.remove(entity);
        }
    }
    async remove(id) {
        const entity = await this.findOne(id);
        return this.emailTemplateRepo.remove(entity);
    }
};
exports.EmailTemplateService = EmailTemplateService;
exports.EmailTemplateService = EmailTemplateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(email_template_entity_1.EmailTemplate)),
    __param(1, (0, typeorm_1.InjectEntityManager)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.EntityManager])
], EmailTemplateService);
//# sourceMappingURL=email-template.service.js.map