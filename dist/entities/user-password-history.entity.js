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
exports.UserPasswordHistory = void 0;
const openapi = require("@nestjs/swagger");
const common_entity_1 = require("./common.entity");
const user_entity_1 = require("./user.entity");
const typeorm_1 = require("typeorm");
let UserPasswordHistory = class UserPasswordHistory extends common_entity_1.CommonEntity {
    static _OPENAPI_METADATA_FACTORY() {
        return { passwordHash: { required: true, type: () => String }, user: { required: true, type: () => require("./user.entity").User } };
    }
};
exports.UserPasswordHistory = UserPasswordHistory;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], UserPasswordHistory.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: "CASCADE" }),
    __metadata("design:type", user_entity_1.User)
], UserPasswordHistory.prototype, "user", void 0);
exports.UserPasswordHistory = UserPasswordHistory = __decorate([
    (0, typeorm_1.Entity)("ss_user_password_history")
], UserPasswordHistory);
//# sourceMappingURL=user-password-history.entity.js.map