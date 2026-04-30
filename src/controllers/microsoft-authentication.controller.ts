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
import { AuthGuard } from "@nestjs/passport";
import type { SolidCoreSetting } from "../services/settings/default-settings-provider.service";
import { Public } from "src/decorators/public.decorator";
import { Auth } from "../decorators/auth.decorator";
import { AuthType } from "../enums/auth-type.enum";

@Auth(AuthType.None)
@ApiTags("Iam")
@Controller("iam/microsoft")
export class MicrosoftAuthenticationController {
  constructor(
    @Inject(AuthenticationService)
    private readonly authService: AuthenticationService,
    @Inject(SettingService)
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

  @Get("connect")
  @Public()
  @UseGuards(AuthGuard("microsoft"))
  async microsoftConnect() {
    await this.validateConfiguration();
  }

  @Get(["connect/callback", "callback"])
  @Public()
  @UseGuards(AuthGuard("microsoft"))
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    const config = await this.validateConfiguration();
    const { accessCode } = req.user as any;
    res.redirect(`${config.redirectURL}?accessCode=${accessCode}`);
  }

  @Get("authenticate")
  @Public()
  @ApiQuery({ name: "accessCode", required: true, type: String })
  async microsoftAuth(@Query("accessCode") accessCode: string) {
    await this.validateConfiguration();
    return this.authService.signInUsingMicrosoft(accessCode);
  }
}
