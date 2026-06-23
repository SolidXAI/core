import {
  Controller,
  Get,
  InternalServerErrorException,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  DEFAULT_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT,
  MicrosoftActiveDirectoryAuthConfiguration,
  isMicrosoftActiveDirectoryOAuthConfigured,
} from "../helpers/microsoft-active-directory-oauth.helper";
import { AuthenticationService } from "../services/authentication.service";
import { SettingService } from "../services/setting.service";
import { Public } from "src/decorators/public.decorator";
import { Auth } from "../decorators/auth.decorator";
import { AuthType } from "../enums/auth-type.enum";
import { MicrosoftActiveDirectoryOauthGuard } from "../passport-strategies/microsoft-active-directory-oauth.strategy";
import { UserService } from "../services/user.service";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";

@Auth(AuthType.None)
@ApiTags("Solid Core")
@Controller("iam/microsoft-active-directory")
export class MicrosoftActiveDirectoryAuthenticationController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthenticationService,
    private readonly settingService: SettingService,
  ) {}

  private async getConfiguration(): Promise<MicrosoftActiveDirectoryAuthConfiguration> {
    return {
      clientID: this.settingService.getConfigValue<SolidCoreSetting>("MICROSOFT_ACTIVE_DIRECTORY_CLIENT_ID"),
      clientSecret: this.settingService.getConfigValue<SolidCoreSetting>("MICROSOFT_ACTIVE_DIRECTORY_CLIENT_SECRET"),
      tenant: this.settingService.getConfigValue<SolidCoreSetting>("MICROSOFT_ACTIVE_DIRECTORY_TENANT_ID" ) ?? DEFAULT_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT,
      callbackURL: this.settingService.getConfigValue<SolidCoreSetting>("MICROSOFT_ACTIVE_DIRECTORY_CALLBACK_URL"), 
      redirectURL: this.settingService.getConfigValue<SolidCoreSetting>("MICROSOFT_ACTIVE_DIRECTORY_REDIRECT_URL"),
    };
  }

  private buildFrontendRedirectUrl(redirectURL: string, accessCode: string) {
    const separator = redirectURL.includes("?") ? "&" : "?";
    return `${redirectURL}${separator}accessCode=${encodeURIComponent(accessCode)}`;
  }

  private async validateConfiguration() {
    const config = await this.getConfiguration();
    if (!isMicrosoftActiveDirectoryOAuthConfigured(config)) {
      throw new InternalServerErrorException("Microsoft Active Directory OAuth is not configured");
    }
    return config;
  }

  @Public()
  @UseGuards(MicrosoftActiveDirectoryOauthGuard)
  @Get("connect")
  async connect() {
    await this.validateConfiguration();
  }

  @Public()
  @Get("connect/callback")
  @UseGuards(MicrosoftActiveDirectoryOauthGuard)
  async microsoftActiveDirectoryAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const config = await this.validateConfiguration();
    const user = req.user;
    return res.redirect(
      this.buildFrontendRedirectUrl(config.redirectURL, user["accessCode"]),
    );
  }

  @Public()
  @Get("dummy-redirect")
  async dummyMicrosoftActiveDirectoryAuthRedirect(
    @Query("accessCode") accessCode,
  ) {
    await this.validateConfiguration();
    const user = await this.userService.findOneByAccessCode(accessCode);

    if (user) {
      delete user["password"];
    }

    return user;
  }

  @Public()
  @Get("authenticate")
  @ApiQuery({ name: "accessCode", required: true, type: String })
  async microsoftActiveDirectoryAuth(
    @Query("accessCode") accessCode: string,
  ) {
    await this.validateConfiguration();
    return this.authService.signInUsingMicrosoftActiveDirectory(accessCode);
  }
}
