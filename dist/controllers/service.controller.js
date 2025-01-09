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
exports.ServiceController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../decorators/public.decorator");
const solid_registry_1 = require("../helpers/solid-registry");
const swagger_1 = require("@nestjs/swagger");
let ServiceController = class ServiceController {
    constructor(solidRegistry) {
        this.solidRegistry = solidRegistry;
    }
    pingPong() {
        return { pong: 'v1.0.2' };
    }
};
exports.ServiceController = ServiceController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('ping'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ServiceController.prototype, "pingPong", null);
exports.ServiceController = ServiceController = __decorate([
    (0, common_1.Controller)(''),
    (0, swagger_1.ApiTags)("Common"),
    __metadata("design:paramtypes", [solid_registry_1.SolidRegistry])
], ServiceController);
//# sourceMappingURL=service.controller.js.map