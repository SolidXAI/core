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
var SoftDeleteAwareEventSubscriber_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoftDeleteAwareEventSubscriber = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let SoftDeleteAwareEventSubscriber = SoftDeleteAwareEventSubscriber_1 = class SoftDeleteAwareEventSubscriber {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(SoftDeleteAwareEventSubscriber_1.name);
        this.dataSource.subscribers.push(this);
    }
    beforeSoftRemove(event) {
        if (!event.entity)
            return;
        const entity = event.entity;
        if (!entity.deletedAt) {
            entity.deletedTracker = `${new Date()}`;
        }
        else {
            entity.deletedTracker = `${entity.deletedAt}`;
        }
        console.log('TrackerDate updated:', entity.trackerDate);
    }
    beforeRecover(event) {
        if (!event.entity)
            return;
        const entity = event.entity;
        entity.deletedTracker = "not-deleted";
    }
};
exports.SoftDeleteAwareEventSubscriber = SoftDeleteAwareEventSubscriber;
exports.SoftDeleteAwareEventSubscriber = SoftDeleteAwareEventSubscriber = SoftDeleteAwareEventSubscriber_1 = __decorate([
    (0, typeorm_2.EventSubscriber)(),
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], SoftDeleteAwareEventSubscriber);
//# sourceMappingURL=softDeleteAwareEventSubscriber.subscriber.js.map