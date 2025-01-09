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
var UserRegistrationListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRegistrationListener = void 0;
const event_emitter_1 = require("@nestjs/event-emitter");
const common_1 = require("@nestjs/common");
const interfaces_1 = require("../interfaces");
let UserRegistrationListener = UserRegistrationListener_1 = class UserRegistrationListener {
    constructor() {
        this.logger = new common_1.Logger(UserRegistrationListener_1.name);
    }
    handleUserRegistration(event) {
        this.logger.log(`User registered with details: ${JSON.stringify(event.payload)}`);
    }
};
exports.UserRegistrationListener = UserRegistrationListener;
__decorate([
    (0, event_emitter_1.OnEvent)(interfaces_1.EventType.USER_REGISTERED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [interfaces_1.EventDetails]),
    __metadata("design:returntype", void 0)
], UserRegistrationListener.prototype, "handleUserRegistration", null);
exports.UserRegistrationListener = UserRegistrationListener = UserRegistrationListener_1 = __decorate([
    (0, common_1.Injectable)()
], UserRegistrationListener);
//# sourceMappingURL=user-registration.listener.js.map