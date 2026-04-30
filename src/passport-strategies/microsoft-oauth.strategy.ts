import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-microsoft";
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { SettingService } from "../services/setting.service";
import {
  MicrosoftAuthConfiguration,
  isMicrosoftOAuthConfigured,
} from "../helpers/microsoft-oauth.helper";
import { UserService } from "../services/user.service";
import { v4 as uuid } from "uuid";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";

const DUMMY_CLIENT_ID = "DUMMY_CLIENT_ID";
const DUMMY_CLIENT_SECRET = "DUMMY_CLIENT_SECRET";
const DUMMY_TENANT = "common";
const DUMMY_CALLBACK_URL = "DUMMY_CALLBACK_URL";

@Injectable()
export class MicrosoftOAuthStrategy extends PassportStrategy(
  Strategy,
  "microsoft",
) {
  private readonly logger = new Logger(MicrosoftOAuthStrategy.name);

  constructor(
    @Inject(SettingService)
    private readonly settingService: SettingService,
    private readonly userService: UserService,
  ) {
    const clientID =
      process.env.IAM_MICROSOFT_OAUTH_CLIENT_ID ?? DUMMY_CLIENT_ID;
    const clientSecret =
      process.env.IAM_MICROSOFT_OAUTH_CLIENT_SECRET ?? DUMMY_CLIENT_SECRET;
    const tenant =
      process.env.IAM_MICROSOFT_OAUTH_TENANT_ID ?? DUMMY_TENANT;
    const callbackURL =
      process.env.IAM_MICROSOFT_OAUTH_CALLBACK_URL ?? DUMMY_CALLBACK_URL;
    
    super({
      clientID,
      clientSecret,
      callbackURL,
      tenant,
      addUPNAsEmail: true,
      scope: ["user.read"],
    });

    const microsoftOauth: MicrosoftAuthConfiguration = {
      clientID,
      clientSecret,
      tenant,
      callbackURL,
      redirectURL: process.env.IAM_MICROSOFT_OAUTH_REDIRECT_URL,
    };
    if (!isMicrosoftOAuthConfigured(microsoftOauth)) {
      this.logger.debug("Microsoft OAuth strategy is not configured");
    }
  }

  async authenticate(req: any, options: any) {
    const [clientID, clientSecret, tenant, callbackURL] = await Promise.all([
      this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_CLIENT_ID" as any,
      ),
      this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_CLIENT_SECRET" as any,
      ),
      this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_TENANT_ID" as any,
      ),
      this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_CALLBACK_URL" as any,
      ),
    ]);

    if (!clientID || !clientSecret || !tenant || !callbackURL) {
      throw new InternalServerErrorException(
        "Microsoft OAuth is not configured",
      );
    }

    (this as any)._oauth2._clientId = clientID;
    (this as any)._oauth2._clientSecret = clientSecret;
    (this as any)._callbackURL = callbackURL;
    (this as any)._oauth2._authorizeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
    (this as any)._oauth2._accessTokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

    return super.authenticate(req, options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { id, displayName, emails } = profile;
    const loginAccessCode: string = uuid();

    const email = emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;

    if (!email) {
      throw new UnauthorizedException("Microsoft OAuth did not return an email address");
    }

    const user = {
      provider: "microsoft",
      providerId: id,
      email: email,
      name: displayName,
      accessCode: loginAccessCode,
    };

    await this.userService.resolveUserOnOauthMicrosoft({
      ...user,
      accessToken,
      refreshToken: null,
      picture: null,
    });

    done(null, user);
  }
}
