import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { DEFAULT_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT, MICROSOFT_ACTIVE_DIRECTORY_OAUTH_SCOPES, MicrosoftActiveDirectoryAuthConfiguration, getMicrosoftActiveDirectoryOAuthDisplayName, getMicrosoftActiveDirectoryOAuthEmail, getMicrosoftActiveDirectoryOAuthPicture, getMicrosoftActiveDirectoryOAuthProfileId, isMicrosoftActiveDirectoryOAuthConfigured } from 'src/helpers/microsoft-active-directory-oauth.helper';
import { v4 as uuid } from 'uuid';
import { UserService } from '../services/user.service';

const DUMMY_CLIENT_ID = 'DUMMY_CLIENT_ID';
const DUMMY_CLIENT_SECRET = 'DUMMY_CLIENT_SECRET';
const DUMMY_CALLBACK_URL = 'DUMMY_CALLBACK_URL';

@Injectable()
export class MicrosoftActiveDirectoryOauthGuard extends AuthGuard('microsoft-active-directory') { }


@Injectable()
export class MicrosoftActiveDirectoryOAuthStrategy extends PassportStrategy(Strategy, 'microsoft-active-directory') {
  private readonly logger = new Logger(MicrosoftActiveDirectoryOAuthStrategy.name);
  constructor(private readonly userService: UserService) {
    // TODO: Have added default dummy values for the configuration, since the configuration is not mandatory.
    // Perhaps a cleaner way needs to be figured out
    const clientID = process.env.IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CLIENT_ID || DUMMY_CLIENT_ID;
    const clientSecret = process.env.IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CLIENT_SECRET || DUMMY_CLIENT_SECRET;
    const tenant = process.env.IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT_ID || DEFAULT_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT;
    const callbackURL = process.env.IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL || DUMMY_CALLBACK_URL;
    const redirectURL = process.env.IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL;

    super({ clientID, clientSecret, callbackURL, tenant, scope: MICROSOFT_ACTIVE_DIRECTORY_OAUTH_SCOPES, addUPNAsEmail: true });

    const microsoftActiveDirectoryOauth: MicrosoftActiveDirectoryAuthConfiguration = { clientID, clientSecret, tenant, callbackURL, redirectURL }
    if (!isMicrosoftActiveDirectoryOAuthConfigured(microsoftActiveDirectoryOauth)) {
      this.logger.debug('Microsoft Active Directory OAuth strategy is not configured');
    }
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: any): Promise<any> {
    const providerId = getMicrosoftActiveDirectoryOAuthProfileId(profile);

    if (!providerId) {
      return done(new UnauthorizedException('Microsoft Active Directory OAuth profile is missing an id'), false);
    }

    // generate a unique access code. 
    const loginAccessCode: string = uuid();

    const user = {
      provider: 'microsoftActiveDirectory',
      providerId,
      email: getMicrosoftActiveDirectoryOAuthEmail(profile),
      name: getMicrosoftActiveDirectoryOAuthDisplayName(profile) || getMicrosoftActiveDirectoryOAuthEmail(profile) || 'Microsoft Active Directory User',
      picture: getMicrosoftActiveDirectoryOAuthPicture(profile),
      accessCode: loginAccessCode,
    };

    // store the access code and the access token in the database. 
    // while doing this we also check if the user exists in the database if not we create one. 
    // if exists then we update the user and store the specified access code & token.
    await this.userService.resolveUserOnOauthMicrosoftActiveDirectory({ ...user, accessToken: _accessToken, refreshToken: null });

    done(null, user);
  }

}
