import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth2';
import { Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { v4 as uuid } from 'uuid';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
import { iamConfig } from '../config/iam.config';


@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') { }


@Injectable()
export class GoogleOauthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(iamConfig.KEY) private iamConfiguration: ConfigType<typeof iamConfig>,
    private readonly authService: AuthenticationService,
    private readonly userService: UserService
  ) {
    super({
      clientID: iamConfiguration.googleOauth.clientID,
      clientSecret: iamConfiguration.googleOauth.clientSecret,
      callbackURL: iamConfiguration.googleOauth.callbackURL,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    // generate a unique access code. 
    const loginAccessCode: string = uuid();

    const user = {
      provider: 'google',
      providerId: id,
      email: emails[0].value,
      name: `${name.givenName} ${name.familyName}`,
      picture: photos[0].value,
      accessCode: loginAccessCode,
    };

    // store the access code and the access token in the database. 
    // while doing this we also check if the user exists in the database if not we create one. 
    // if exists then we update the user and store the specified access code & token.
    await this.userService.resolveUserOnOauthGoogle({ ...user, accessToken: _accessToken, refreshToken: null });

    done(null, user);
  }
}