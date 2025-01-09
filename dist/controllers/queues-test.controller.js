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
exports.QueuesTestController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorator_1 = require("../decorators/auth.decorator");
const public_decorator_1 = require("../decorators/public.decorator");
const auth_type_enum_1 = require("../enums/auth-type.enum");
const queue_test_publisher_service_1 = require("../jobs/queue-test-publisher.service");
let QueuesTestController = class QueuesTestController {
    constructor(publisher) {
        this.publisher = publisher;
    }
    async getHello() {
        const pubsubMessage = 'A hopping-good time!';
        const m = {
            payload: {
                firstName: 'Harish',
                lastName: 'Patel',
                age: 40
            },
            parentEntity: 'Address',
            parentEntityId: 23,
        };
        await this.publisher.publish(m);
        return {};
    }
};
exports.QueuesTestController = QueuesTestController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueuesTestController.prototype, "getHello", null);
exports.QueuesTestController = QueuesTestController = __decorate([
    (0, auth_decorator_1.Auth)(auth_type_enum_1.AuthType.None),
    (0, common_1.Controller)('queues'),
    (0, swagger_1.ApiTags)("Queues"),
    __metadata("design:paramtypes", [queue_test_publisher_service_1.TestQueuePublisher])
], QueuesTestController);
//# sourceMappingURL=queues-test.controller.js.map