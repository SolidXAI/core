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
var UserSeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSeederService = void 0;
const common_1 = require("@nestjs/common");
const authentication_service_1 = require("../services/authentication.service");
const user_service_1 = require("../services/user.service");
let UserSeederService = UserSeederService_1 = class UserSeederService {
    constructor(authenticationService, userService) {
        this.authenticationService = authenticationService;
        this.userService = userService;
        this.logger = new common_1.Logger(UserSeederService_1.name);
    }
    async seed() {
        let user = await this.userService.findOneByUsername("admin@example.service.com");
        if (!user) {
            user = await this.authenticationService.signUp({
                username: 'admin@example.service.com',
                email: 'admin@example.service.com',
                password: 'Admin@3214$',
            });
            this.logger.log(`Newly created user is ${user}`);
        }
        await this.userService.addRoleToUser(user.email, "Admin");
        await this.userService.addRoleToUser(user.email, "Public");
    }
};
exports.UserSeederService = UserSeederService;
exports.UserSeederService = UserSeederService = UserSeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [authentication_service_1.AuthenticationService,
        user_service_1.UserService])
], UserSeederService);
//# sourceMappingURL=user-seeder.service.js.map