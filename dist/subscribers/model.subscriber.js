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
var ModelSubscriber_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelSubscriber = void 0;
const typeorm_1 = require("typeorm");
const model_metadata_entity_1 = require("../entities/model-metadata.entity");
const field_metadata_entity_1 = require("../entities/field-metadata.entity");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("@nestjs/typeorm");
let ModelSubscriber = ModelSubscriber_1 = class ModelSubscriber {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(ModelSubscriber_1.name);
        this.dataSource.subscribers.push(this);
    }
    listenTo() {
        return model_metadata_entity_1.ModelMetadata;
    }
    async afterInsert(event) {
        this.logger.debug(`[ModelSubscriber] getting invoked for insert on model: ${event.entity.singularName}`);
        const transactionManager = event.queryRunner?.manager;
        if (!transactionManager) {
            throw new common_1.NotFoundException(`Trnasaction Manager not found`);
        }
        const systemFieldsMetadata = [
            {
                name: "id",
                displayName: "Id",
                type: "int",
                ormType: "bigint",
                isSystem: true,
                model: event.entity,
            },
            {
                name: "createdAt",
                displayName: "Created At",
                type: "datetime",
                ormType: "timestamp",
                isSystem: true,
                model: event.entity,
            },
            {
                name: "updatedAt",
                displayName: "Updated At",
                type: "datetime",
                ormType: "timestamp",
                isSystem: true,
                model: event.entity,
            },
            {
                name: "deletedAt",
                displayName: "Deleted At",
                type: "datetime",
                ormType: "timestamp",
                isSystem: true,
                model: event.entity,
            },
        ];
        transactionManager.save(field_metadata_entity_1.FieldMetadata, systemFieldsMetadata);
    }
};
exports.ModelSubscriber = ModelSubscriber;
exports.ModelSubscriber = ModelSubscriber = ModelSubscriber_1 = __decorate([
    (0, typeorm_1.EventSubscriber)(),
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_2.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ModelSubscriber);
//# sourceMappingURL=model.subscriber.js.map