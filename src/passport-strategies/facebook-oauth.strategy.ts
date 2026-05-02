import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { FacebookAuthConfiguration, isFacebookOAuthConfigured } from 'src/helpers/facebook-oauth.helper';
import { v4 as uuid } from 'uuid';
import { UserService } from '../services/user.service';

const DUMMY_CLIENT_ID = 'DUMMY_CLIENT_ID';
const DUMMY_CLIENT_SECRET = 'DUMMY_CLIENT_SECRET';
const DUMMY_CALLBACK_URL = 'DUMMY_CALLBACK_URL';

@Injectable()
export class FacebookOauthGuard extends AuthGuard('facebook') { }

@Injectable()
export class FacebookOAuthStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookOAuthStrategy.name);

  constructor(private readonly userService: UserService) {
    // Reading configuration from environment variables (Static approach like Google)
    const clientID = process.env.IAM_FACEBOOK_OAUTH_CLIENT_ID ?? DUMMY_CLIENT_ID;
    const clientSecret = process.env.IAM_FACEBOOK_OAUTH_CLIENT_SECRET ?? DUMMY_CLIENT_SECRET;
    const callbackURL = process.env.IAM_FACEBOOK_OAUTH_CALLBACK_URL ?? DUMMY_CALLBACK_URL;
    const redirectURL = process.env.IAM_FACEBOOK_OAUTH_REDIRECT_URL;

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email'],
      profileFields: ['id', 'emails', 'name', 'photos'],
    });

    const facebookOauth: FacebookAuthConfiguration = { clientID, clientSecret, callbackURL, redirectURL };
    if (!isFacebookOAuthConfigured(facebookOauth)) {
      this.logger.debug('Facebook OAuth strategy is not configured');
    }
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: any): Promise<any> {
    const { id, name, emails, photos } = profile;

    // generate a unique access code. 
    const loginAccessCode: string = uuid();

    const user = {
      provider: 'facebook',
      providerId: id,
      email: emails?.[0]?.value,
      name: `${name.givenName} ${name.familyName}`,
      picture: photos?.[0]?.value,
      accessCode: loginAccessCode,
    };

    // store the access code and the access token in the database. 
    await this.userService.resolveUserOnOauthFacebook({ 
        ...user, 
        accessToken: _accessToken, 
        refreshToken: null 
    });

    done(null, user);
  }
}