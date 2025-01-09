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
var TestController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestController = exports.SeedData = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const solid_registry_1 = require("../helpers/solid-registry");
const auth_decorator_1 = require("../decorators/auth.decorator");
const public_decorator_1 = require("../decorators/public.decorator");
const auth_type_enum_1 = require("../enums/auth-type.enum");
class SeedData {
}
exports.SeedData = SeedData;
let TestController = TestController_1 = class TestController {
    constructor(solidRegistry) {
        this.solidRegistry = solidRegistry;
        this.logger = new common_1.Logger(TestController_1.name);
    }
    uploadData(files, body) {
        return { message: 'file uploaded', fileNames: files.map(f => f.originalname), formData: body };
    }
    uploadFile(file, body) {
        console.log(file);
        console.log(body);
        return { filename: file.originalname };
    }
    async seedData(seedData) {
        const seeder = this.solidRegistry
            .getSeeders()
            .filter((seeder) => seeder.name === seedData.seeder)
            .map((seeder) => seeder.instance)
            .pop();
        if (!seeder) {
            this.logger.error(`Seeder service ${seedData.seeder} not found. Does your service have a seed() method?`);
            return;
        }
        this.logger.log(`Running the seed() method for seeder :${seeder.constructor.name}`);
        await seeder.seed();
        return { message: `seed data for ${seedData.seeder}` };
    }
};
exports.TestController = TestController;
__decorate([
    (0, auth_decorator_1.Auth)(auth_type_enum_1.AuthType.None),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    (0, common_1.Post)('uploads'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", void 0)
], TestController.prototype, "uploadData", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TestController.prototype, "uploadFile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('seed'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TestController.prototype, "seedData", null);
exports.TestController = TestController = TestController_1 = __decorate([
    (0, auth_decorator_1.Auth)(auth_type_enum_1.AuthType.None),
    (0, common_1.Controller)('test'),
    (0, swagger_1.ApiTags)("App Builder"),
    __metadata("design:paramtypes", [solid_registry_1.SolidRegistry])
], TestController);
//# sourceMappingURL=test.controller.js.map