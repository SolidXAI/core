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
exports.GoogleOauthStrategy = exports.GoogleOauthGuard = void 0;
const passport_1 = require("@nestjs/passport");
const passport_google_oauth2_1 = require("passport-google-oauth2");
const common_1 = require("@nestjs/common");
const passport_2 = require("@nestjs/passport");
const uuid_1 = require("uuid");
const authentication_service_1 = require("../services/authentication.service");
const user_service_1 = require("../services/user.service");
const iam_config_1 = require("../config/iam.config");
let GoogleOauthGuard = class GoogleOauthGuard extends (0, passport_2.AuthGuard)('google') {
};
exports.GoogleOauthGuard = GoogleOauthGuard;
exports.GoogleOauthGuard = GoogleOauthGuard = __decorate([
    (0, common_1.Injectable)()
], GoogleOauthGuard);
let GoogleOauthStrategy = class GoogleOauthStrategy extends (0, passport_1.PassportStrategy)(passport_google_oauth2_1.Strategy, 'google') {
    constructor(iamConfiguration, authService, userService) {
        super({
            clientID: iamConfiguration.googleOauth.clientID,
            clientSecret: iamConfiguration.googleOauth.clientSecret,
            callbackURL: iamConfiguration.googleOauth.callbackURL,
            scope: ['profile', 'email'],
        });
        this.iamConfiguration = iamConfiguration;
        this.authService = authService;
        this.userService = userService;
    }
    async validate(_accessToken, _refreshToken, profile, done) {
        const { id, name, emails, photos } = profile;
        const loginAccessCode = (0, uuid_1.v4)();
        const user = {
            provider: 'google',
            providerId: id,
            email: emails[0].value,
            name: `${name.givenName} ${name.familyName}`,
            picture: photos[0].value,
            accessCode: loginAccessCode,
        };
        await this.userService.resolveUserOnOauthGoogle({ ...user, accessToken: _accessToken, refreshToken: null });
        done(null, user);
    }
};
exports.GoogleOauthStrategy = GoogleOauthStrategy;
exports.GoogleOauthStrategy = GoogleOauthStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(iam_config_1.iamConfig.KEY)),
    __metadata("design:paramtypes", [void 0, authentication_service_1.AuthenticationService,
        user_service_1.UserService])
], GoogleOauthStrategy);
//# sourceMappingURL=google-oauth.strategy.js.map