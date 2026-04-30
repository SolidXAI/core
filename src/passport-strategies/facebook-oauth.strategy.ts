import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-facebook";
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { SettingService } from "../services/setting.service";
import {
  FacebookAuthConfiguration,
  isFacebookOAuthConfigured,
} from "../helpers/facebook-oauth.helper";
import { UserService } from "../services/user.service";
import { v4 as uuid } from "uuid";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";

const DUMMY_CLIENT_ID = "DUMMY_CLIENT_ID";
const DUMMY_CLIENT_SECRET = "DUMMY_CLIENT_SECRET";
const DUMMY_CALLBACK_URL = "DUMMY_CALLBACK_URL";

@Injectable()
export class FacebookOAuthStrategy extends PassportStrategy(
  Strategy,
  "facebook",
) {
  private readonly logger = new Logger(FacebookOAuthStrategy.name);

  constructor(
    @Inject(SettingService)
    private readonly settingService: SettingService,
    private readonly userService: UserService,
  ) {
    const clientID =
      process.env.IAM_FACEBOOK_OAUTH_CLIENT_ID ?? DUMMY_CLIENT_ID;
    const clientSecret =
      process.env.IAM_FACEBOOK_OAUTH_CLIENT_SECRET ?? DUMMY_CLIENT_SECRET;
    const callbackURL =
      process.env.IAM_FACEBOOK_OAUTH_CALLBACK_URL ?? DUMMY_CALLBACK_URL;
    const redirectURL =
      process.env.IAM_FACEBOOK_OAUTH_REDIRECT_URL ?? DUMMY_CALLBACK_URL;
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ["email"],
      profileFields: ["id", "emails", "name", "displayName"],
    });

    const facebookOauth: FacebookAuthConfiguration = {
      clientID,
      clientSecret,
      callbackURL,
      redirectURL,
    };
    if (!isFacebookOAuthConfigured(facebookOauth)) {
      this.logger.debug("Facebook OAuth strategy is not configured");
    }
  }

  async authenticate(req: any, options: any) {
    const [clientID, clientSecret, callbackURL] = await Promise.all([
      this.settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CLIENT_ID",
      ),
      this.settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CLIENT_SECRET",
      ),
      this.settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CALLBACK_URL",
      ),
    ]);

    if (!clientID || !clientSecret || !callbackURL) {
      throw new InternalServerErrorException(
        "Facebook OAuth is not configured",
      );
    }

    // (this as any)._oauth2._clientId = clientID;
    // (this as any)._oauth2._clientSecret = clientSecret;
    // (this as any)._callbackURL = callbackURL;

    return super.authenticate(req, options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { id, name, emails } = profile;
    const loginAccessCode: string = uuid();
    const email = emails?.[0]?.value;

    if (!email) {
      throw new UnauthorizedException(
        "Facebook OAuth did not return an email address",
      );
    }

    const user = {
      provider: "facebook",
      providerId: id,
      email,
      name:
        [name?.givenName, name?.familyName].filter(Boolean).join(" ") ||
        profile.displayName,
      accessCode: loginAccessCode,
    };

    await this.userService.resolveUserOnOauthFacebook({
      ...user,
      accessToken,
      refreshToken: null,
      picture: null,
    });

    done(null, user);
  }
}
