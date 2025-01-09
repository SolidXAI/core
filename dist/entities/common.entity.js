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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonEntity = void 0;
const openapi = require("@nestjs/swagger");
const typeorm_1 = require("typeorm");
class CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { id: { required: true, type: () => Number }, createdAt: { required: true, type: () => Date }, updatedAt: { required: true, type: () => Date }, deletedAt: { required: true, type: () => Date }, deletedTracker: { required: true, type: () => String } };
    }
}
exports.CommonEntity = CommonEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: 'integer' }),
    __metadata("design:type", Number)
], CommonEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], CommonEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], CommonEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: "timestamp", name: "deleted_at" }),
    __metadata("design:type", Date)
], CommonEntity.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "deletedTracker", default: "not-deleted" }),
    __metadata("design:type", String)
], CommonEntity.prototype, "deletedTracker", void 0);
//# sourceMappingURL=common.entity.js.map