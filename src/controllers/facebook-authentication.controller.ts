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
  FacebookAuthConfiguration,
  isFacebookOAuthConfigured,
} from "../helpers/facebook-oauth.helper";
import { AuthenticationService } from "../services/authentication.service";
import { SettingService } from "../services/setting.service";
import { AuthGuard } from "@nestjs/passport";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";
import { Public } from "src/decorators/public.decorator";
import { Auth } from "../decorators/auth.decorator";
import { AuthType } from "../enums/auth-type.enum";

@Auth(AuthType.None)
@ApiTags("Iam")
@Controller("iam/facebook")
export class FacebookAuthenticationController {
  constructor(
    @Inject(AuthenticationService)
    private readonly authService: AuthenticationService,
    @Inject(SettingService)
    private readonly settingService: SettingService,
  ) {}

  private async getConfiguration(): Promise<FacebookAuthConfiguration> {
    return {
      clientID:
        await this.settingService.getConfigValue<SolidCoreSetting>(
          "FACEBOOK_CLIENT_ID",
        ),
      clientSecret: await this.settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CLIENT_SECRET",
      ),
      callbackURL: await this.settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_CALLBACK_URL",
      ),
      redirectURL: await this.settingService.getConfigValue<SolidCoreSetting>(
        "FACEBOOK_REDIRECT_URL",
      ),
    };
  }

  private async validateConfiguration() {
    const config = await this.getConfiguration();
    if (!isFacebookOAuthConfigured(config)) {
      throw new InternalServerErrorException(
        "Facebook OAuth is not configured",
      );
    }
    return config;
  }

  @Get("connect")
  @Public()
  @UseGuards(AuthGuard("facebook"))
  async facebookConnect() {
    await this.validateConfiguration();
  }

  @Get(["connect/callback", "callback"])
  @Public()
  @UseGuards(AuthGuard("facebook"))
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const config = await this.validateConfiguration();
    const { accessCode } = req.user as any;
    res.redirect(`${config.redirectURL}?accessCode=${accessCode}`);
  }

  @Get("authenticate")
  @Public()
  @ApiQuery({ name: "accessCode", required: true, type: String })
  async facebookAuth(@Query("accessCode") accessCode: string) {
    await this.validateConfiguration();
    return this.authService.signInUsingFacebook(accessCode);
  }
}
