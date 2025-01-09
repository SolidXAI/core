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
exports.ListOfValuesService = void 0;
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const list_of_values_entity_1 = require("../entities/list-of-values.entity");
const common_1 = require("@nestjs/common");
let ListOfValuesService = class ListOfValuesService {
    constructor(listOfValuesRepo) {
        this.listOfValuesRepo = listOfValuesRepo;
    }
    findAll(paginationQuery) {
        const { limit, offset } = paginationQuery;
        return this.listOfValuesRepo.find({
            relations: {},
            skip: offset,
            take: limit,
        });
    }
    async findOneByValueAndType(lovValue, lovType) {
        return await this.listOfValuesRepo.findOne({
            where: {
                value: lovValue,
                type: lovType,
            },
        });
    }
    async findOne(id, relations = {}) {
        const lov = await this.listOfValuesRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!lov) {
            throw new common_1.NotFoundException(`list of values #${id} not found`);
        }
        return lov;
    }
    async create(createDto) {
        const lov = this.listOfValuesRepo.create(createDto);
        return this.listOfValuesRepo.save(lov);
    }
    async remove(id) {
        const lov = await this.findOne(id);
        return this.listOfValuesRepo.remove(lov);
    }
};
exports.ListOfValuesService = ListOfValuesService;
exports.ListOfValuesService = ListOfValuesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(list_of_values_entity_1.ListOfValues)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListOfValuesService);
//# sourceMappingURL=list-of-values.service.js.map