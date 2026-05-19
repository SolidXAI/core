import {
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  MicrosoftAuthConfiguration,
  isMicrosoftOAuthConfigured,
} from "../helpers/microsoft-oauth.helper";
import { AuthenticationService } from "../services/authentication.service";
import { SettingService } from "../services/setting.service";
import { Public } from "src/decorators/public.decorator";
import { Auth } from "../decorators/auth.decorator";
import { AuthType } from "../enums/auth-type.enum";
import { MicrosoftOauthGuard } from "../passport-strategies/microsoft-oauth.strategy";
import { UserService } from "../services/user.service";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";

@Auth(AuthType.None)
@ApiTags("Solid Core")
@Controller("iam/microsoft")
export class MicrosoftAuthenticationController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthenticationService,
    private readonly settingService: SettingService,
  ) {}

  private async getConfiguration(): Promise<MicrosoftAuthConfiguration> {
    return {
      clientID:
        await this.settingService.getConfigValue<SolidCoreSetting>(
          "MICROSOFT_CLIENT_ID" as any,
        ),
      clientSecret: await this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_CLIENT_SECRET" as any,
      ),
      tenant: await this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_TENANT_ID" as any,
      ),
      callbackURL: await this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_CALLBACK_URL" as any,
      ),
      redirectURL: await this.settingService.getConfigValue<SolidCoreSetting>(
        "MICROSOFT_REDIRECT_URL" as any,
      ),
    };
  }

  private async validateConfiguration() {
    const config = await this.getConfiguration();
    if (!isMicrosoftOAuthConfigured(config)) {
      throw new InternalServerErrorException(
        "Microsoft OAuth is not configured",
      );
    }
    return config;
  }

  @Public()
  @UseGuards(MicrosoftOauthGuard)
  @Get("connect")
  async connect() {
    await this.validateConfiguration();
  }

  @Public()
  @Get("connect/callback")
  @UseGuards(MicrosoftOauthGuard)
  async microsoftAuthCallback(@Req() req: Request, @Res() res: Response) {
    const config = await this.validateConfiguration();
    const user = req.user;
    return res.redirect(`${config.redirectURL}?accessCode=${user['accessCode']}`);
  }

  /**
   * This is just a dummy endpoint where we are passing in the accessCode, this will be configured in the .env as an environment variable and 
   * will be passed the accessCode, using the accessCode the UI code on this page will mostly invoke the /iam/microsoft/auth endpoint which will finally generate the JWT token.
   * 
   * @param accessCode 
   * @returns 
   */
  @Public()
  @Get('dummy-redirect')
  async dummyMicrosoftAuthRedirect(@Query('accessCode') accessCode) {
      await this.validateConfiguration();
      const user = await this.userService.findOneByAccessCode(accessCode);

      if (user) {
          delete user['password'];
      }

      return user;
  }

  /**
   * Use this endpoint to authenticate using an accessCode with Microsoft.
   * 
   * @param accessCode 
   * @returns 
   */
  @Public()
  @Get("authenticate")
  @ApiQuery({ name: "accessCode", required: true, type: String })
  async microsoftAuth(@Query("accessCode") accessCode: string) {
    await this.validateConfiguration();
    return this.authService.signInUsingMicrosoft(accessCode);
  }
}
