import { ConfigType } from '@nestjs/config';
import { Strategy, VerifyCallback } from 'passport-google-oauth2';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
import { iamConfig } from '../config/iam.config';
declare const GoogleOauthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class GoogleOauthGuard extends GoogleOauthGuard_base {
}
declare const GoogleOauthStrategy_base: new (...args: any[]) => Strategy;
export declare class GoogleOauthStrategy extends GoogleOauthStrategy_base {
    private iamConfiguration;
    private readonly authService;
    private readonly userService;
    constructor(iamConfiguration: ConfigType<typeof iamConfig>, authService: AuthenticationService, userService: UserService);
    validate(_accessToken: string, _refreshToken: string, profile: any, done: VerifyCallback): Promise<any>;
}
export {};
