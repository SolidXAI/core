import { Strategy } from 'passport-local';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';


@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthenticationService,
        private userService: UserService,
    ) {
        super();
    }

    async validate(username: string, password: string): Promise<any> {
        const user = await this.authService.validateUser({ username, password, email: null });
        if (!user) {
            throw new UnauthorizedException();
        }
        return user;
    }
}


@Injectable()
export class LocalAuthGuard extends AuthGuard('local') { }
