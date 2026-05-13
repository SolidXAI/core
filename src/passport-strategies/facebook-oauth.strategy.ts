import { Injectable, Logger } from "@nestjs/common";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-facebook";
import {
  FacebookAuthConfiguration,
  isFacebookOAuthConfigured,
} from "src/helpers/facebook-oauth.helper";
import { v4 as uuid } from "uuid";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";
import { SettingService } from "../services/setting.service";
import { UserService } from "../services/user.service";

const DUMMY_CLIENT_ID = "DUMMY_CLIENT_ID";
const DUMMY_CLIENT_SECRET = "DUMMY_CLIENT_SECRET";
const DUMMY_CALLBACK_URL = "DUMMY_CALLBACK_URL";

@Injectable()
export class FacebookOauthGuard extends AuthGuard("facebook") {}

@Injectable()
export class FacebookOAuthStrategy extends PassportStrategy(
  Strategy,
  "facebook",
) {
  private readonly logger = new Logger(FacebookOAuthStrategy.name);

  constructor(
    private readonly userService: UserService,
    private readonly settingService: SettingService,
  ) {
    // Prefer settings cache (same source used by controller validation), fall back to env.
    const clientID =
      settingService.getConfigValue<SolidCoreSetting>("FACEBOOK_CLIENT_ID") ??
      process.env.IAM_FACEBOOK_OAUTH_CLIENT_ID ??
      DUMMY_CLIENT_ID;
    const clientSecret =
      settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CLIENT_SECRET",
      ) ??
      process.env.IAM_FACEBOOK_OAUTH_CLIENT_SECRET ??
      DUMMY_CLIENT_SECRET;
    const callbackURL =
      settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CALLBACK_URL",
      ) ??
      process.env.IAM_FACEBOOK_OAUTH_CALLBACK_URL ??
      DUMMY_CALLBACK_URL;
    const redirectURL =
      settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_REDIRECT_URL",
      ) ?? process.env.IAM_FACEBOOK_OAUTH_REDIRECT_URL;

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ["email"],
      // Facebook Graph API expects "email" and "picture", not "emails"/"photos".
      profileFields: ["id", "name", "email", "picture.type(large)"],
    });

    const facebookOauth: FacebookAuthConfiguration = {
      clientID,
      clientSecret,
      callbackURL,
      redirectURL,
    };
    if (!isFacebookOAuthConfigured(facebookOauth)) {
      this.logger.debug("Facebook OAuth strategy is not configured");
    } else {
      this.logger.debug(
        `Facebook OAuth configured with callbackURL=${callbackURL}`,
      );
    }
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    // generate a unique access code.
    const loginAccessCode: string = uuid();

    const email = emails && emails.length > 0 ? emails[0].value : null;

    const firstName = name?.givenName || "";
    const lastName = name?.familyName || "";
    const fullName =
      firstName || lastName
        ? `${firstName} ${lastName}`.trim()
        : profile.displayName;

    const user = {
      provider: "facebook",
      providerId: id,
      email: email,
      name: `${name.givenName} ${name.familyName}`,
      picture: photos?.[0]?.value,
      accessCode: loginAccessCode,
    };

    // store the access code and the access token in the database.
    await this.userService.resolveUserOnOauthFacebook({
      ...user,
      accessToken: _accessToken,
      refreshToken: null,
    });

    done(null, user);
  }
}
