import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth2';
import { isGoogleOAuthConfigured } from 'src/helpers/google-oauth.helper';
import { v4 as uuid } from 'uuid';
import { iamConfig } from '../config/iam.config';
import { UserService } from '../services/user.service';

const DUMMY_CLIENT_ID = 'DUMMY_CLIENT_ID';
const DUMMY_CLIENT_SECRET = 'DUMMY_CLIENT_SECRET';
const DUMMY_CALLBACK_URL = 'DUMMY_CALLBACK_URL';

@Injectable()
export class GoogleOauthGuard extends AuthGuard('google') { }


@Injectable()
export class GoogleOauthStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleOauthStrategy.name);
  constructor(
    @Inject(iamConfig.KEY) private iamConfiguration: ConfigType<typeof iamConfig>,
    private readonly userService: UserService
  ) {
    // TODO: Have added default dummy values for the configuration, since the configuration is not mandatory.
    // Perhaps a cleaner way needs to be figured out
    super({
      clientID: iamConfiguration.googleOauth.clientID ?? DUMMY_CLIENT_ID,
      clientSecret: iamConfiguration.googleOauth.clientSecret ?? DUMMY_CLIENT_SECRET,
      callbackURL: iamConfiguration.googleOauth.callbackURL ?? DUMMY_CALLBACK_URL,
      scope: ['profile', 'email'],
    });

    if (!isGoogleOAuthConfigured(iamConfiguration)) {
      this.logger.debug('Google OAuth strategy is not configured');
    }
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