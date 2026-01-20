import { Controller, Get, Inject, InternalServerErrorException, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { GoogleAuthConfiguration, isGoogleOAuthConfigured } from 'src/helpers/google-oauth.helper';
import { Auth } from '../decorators/auth.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthType } from '../enums/auth-type.enum';
import { GoogleOauthGuard } from '../passport-strategies/google-oauth.strategy';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
import { SettingService } from 'src/services/setting.service';



@Auth(AuthType.None)
@Controller('iam/google')
@ApiTags("Iam")
// @UseGuards(ThrottlerGuard)
// @SkipThrottle({ login: false, short: false, burst: true, sustained: true }) //Enable the login throttle only 
export class GoogleAuthenticationController {
    constructor(
        private readonly userService: UserService,
        private readonly settingService: SettingService,
        private readonly authService: AuthenticationService,
    ) { }

    @Public()
    @UseGuards(GoogleOauthGuard)
    @Get('connect')
    async connect() {
        await this.validateConfiguration();
    }

    private async validateConfiguration() {
        const googleOauth: GoogleAuthConfiguration = {
            clientID: await this.settingService.getConfigValue("google-oauth", "clientID"),
            clientSecret: await this.settingService.getConfigValue("google-oauth", "clientSecret"),
            callbackURL: await this.settingService.getConfigValue("google-oauth", "callbackURL"),
            redirectURL: await this.settingService.getConfigValue("google-oauth", "redirectURL"),
        }
        if (!isGoogleOAuthConfigured(googleOauth)) {
            throw new InternalServerErrorException('Google OAuth is not configured');
        }
    }

    @Public()
    @Get('connect/callback')
    @UseGuards(GoogleOauthGuard)
    async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
        await this.validateConfiguration();
        const user = req.user;
        const googleOauthRedirectURL = await this.settingService.getConfigValue("google-oauth", "redirectURL");
        // console.log(`Found user: ${JSON.stringify(user)}`);
        // const token = await this.authService.signIn(req.user);
        //   res.cookie('access_token', token, {
        //     maxAge: 2592000000,
        //     sameSite: true,
        //     secure: false,
        //   });
        // return req.user;
        // return res;

        return res.redirect(`${googleOauthRedirectURL}?accessCode=${user['accessCode']}`);
    }

    /**
     * This is just a dummy endpoint where we are passing in the accessCode, this will be configured in the .env as an environment variable and 
     * will be passed the accessCode, using the accessCode the UI code on this page will mostly invoke the /iam/google/auth endpoint which will finally generate the JWT token.
     * 
     * @param accessCode 
     * @returns 
     */
    @Public()
    @Get('dummy-redirect')
    async dummyGoogleAuthRedirect(@Query('accessCode') accessCode) {
        await this.validateConfiguration();
        const user = await this.userService.findOneByAccessCode(accessCode);

        delete user['password'];

        return user;
    }

    /**
     * Use this endpoint to authenticate using an accessCode with Google.
     * 
     * @param accessCode 
     * @returns 
     */
    @Public()
    @Get('authenticate')
    @ApiQuery({ name: 'accessCode', required: true, type: String })
    async googleAuth(@Query('accessCode') accessCode) {
        await this.validateConfiguration();
        return this.authService.signInUsingGoogle(accessCode);
    }
}
