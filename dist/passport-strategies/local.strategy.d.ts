import { Strategy } from 'passport-local';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
declare const LocalStrategy_base: new (...args: any[]) => Strategy;
export declare class LocalStrategy extends LocalStrategy_base {
    private authService;
    private userService;
    constructor(authService: AuthenticationService, userService: UserService);
    validate(username: string, password: string): Promise<any>;
}
declare const LocalAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class LocalAuthGuard extends LocalAuthGuard_base {
}
export {};
