import { Controller, Get, Inject, InternalServerErrorException, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthenticationService } from '../services/authentication.service';
import { Auth } from '../decorators/auth.decorator';
import { AuthType } from '../enums/auth-type.enum';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { GoogleOauthGuard } from '../passport-strategies/google-oauth.strategy';
import { Request, Response } from 'express';
import { ConfigType } from '@nestjs/config';
import { UserService } from '../services/user.service';
import { Public } from '../decorators/public.decorator';
import { iamConfig } from '../config/iam.config';
import { isGoogleOAuthConfigured } from 'src/helpers/google-oauth.helper';


@Auth(AuthType.None)
@Controller('iam/google')
@ApiTags("Iam")
export class GoogleAuthenticationController {
    constructor(
        @Inject(iamConfig.KEY) private iamConfiguration: ConfigType<typeof iamConfig>,
        private readonly userService: UserService,
        private readonly authService: AuthenticationService,
    ) { }

    @Public()
    @UseGuards(GoogleOauthGuard)
    @Get('connect')
    async connect() {
        this.validateConfiguration();
    }

    private validateConfiguration() {
        if (!isGoogleOAuthConfigured(this.iamConfiguration)) {
            throw new InternalServerErrorException('Google OAuth is not configured');
        }
    }

    @Public()
    @Get('connect/callback')
    @UseGuards(GoogleOauthGuard)
    googleAuthCallback(@Req() req: Request, @Res() res: Response) {
        this.validateConfiguration();
        const user = req.user;

        // console.log(`Found user: ${JSON.stringify(user)}`);
        // const token = await this.authService.signIn(req.user);
        //   res.cookie('access_token', token, {
        //     maxAge: 2592000000,
        //     sameSite: true,
        //     secure: false,
        //   });
        // return req.user;
        // return res;

        return res.redirect(`${this.iamConfiguration.googleOauth.redirectURL}?accessCode=${user['accessCode']}`);
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
        this.validateConfiguration();
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
        this.validateConfiguration();
        return this.authService.signInUsingGoogle(accessCode);
    }
}
