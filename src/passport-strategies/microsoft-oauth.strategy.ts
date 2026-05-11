import { Injectable, Logger } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { MicrosoftAuthConfiguration, isMicrosoftOAuthConfigured } from 'src/helpers/microsoft-oauth.helper';
import { v4 as uuid } from 'uuid';
import { UserService } from '../services/user.service';

const DUMMY_CLIENT_ID = 'DUMMY_CLIENT_ID';
const DUMMY_CLIENT_SECRET = 'DUMMY_CLIENT_SECRET';
const DUMMY_TENANT = 'common';
const DUMMY_CALLBACK_URL = 'DUMMY_CALLBACK_URL';

@Injectable()
export class MicrosoftOauthGuard extends AuthGuard('microsoft') { }

@Injectable()
export class MicrosoftOAuthStrategy extends PassportStrategy(Strategy, 'microsoft') {
  private readonly logger = new Logger(MicrosoftOAuthStrategy.name);

  constructor(private readonly userService: UserService) {
    // Reading configuration from environment variables (Static approach like Google)
    const clientID = process.env.IAM_MICROSOFT_OAUTH_CLIENT_ID ?? DUMMY_CLIENT_ID;
    const clientSecret = process.env.IAM_MICROSOFT_OAUTH_CLIENT_SECRET ?? DUMMY_CLIENT_SECRET;
    const tenant = process.env.IAM_MICROSOFT_OAUTH_TENANT_ID ?? DUMMY_TENANT;
    const callbackURL = process.env.IAM_MICROSOFT_OAUTH_CALLBACK_URL ?? DUMMY_CALLBACK_URL;
    const redirectURL = process.env.IAM_MICROSOFT_OAUTH_REDIRECT_URL;

    super({
      clientID,
      clientSecret,
      callbackURL,
      tenant,
      scope: ['user.read'],
      addUPNAsEmail: true,
    });

    const microsoftOauth: MicrosoftAuthConfiguration = { clientID, clientSecret, tenant, callbackURL, redirectURL };
    if (!isMicrosoftOAuthConfigured(microsoftOauth)) {
      this.logger.debug('Microsoft OAuth strategy is not configured');
    }
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: any): Promise<any> {
    const { id, displayName, emails, photos } = profile;

    // generate a unique access code. 
    const loginAccessCode: string = uuid();

    // Handle email fallback logic within the standard validate flow
    const email = emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;

    const user = {
      provider: 'microsoft',
      providerId: id,
      email: email,
      name: displayName,
      picture: photos?.[0]?.value || null,
      accessCode: loginAccessCode,
    };

    // store the access code and the access token in the database. 
    await this.userService.resolveUserOnOauthMicrosoft({ 
        ...user, 
        accessToken: _accessToken, 
        refreshToken: null 
    });

    done(null, user);
  }
}