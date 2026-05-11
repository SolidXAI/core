import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Res, Headers, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ActiveUser } from "../decorators/active-user.decorator";
import { Public } from '../decorators/public.decorator';
import { ChangePasswordDto } from "../dtos/change-password.dto";
import { ConfirmForgotPasswordDto } from '../dtos/confirm-forgot-password.dto';
import { CreateApiKeyDto } from '../dtos/create-api-key.dto';
import { UpdateApiKeyDto } from '../dtos/update-api-key.dto';
import { InitiateForgotPasswordDto } from '../dtos/initiate-forgot-password.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { SsoExchangeDto } from '../dtos/sso-exchange.dto';
import { SignInDto } from '../dtos/sign-in.dto';
import { RegisterPrivateDto } from '../dtos/register-private.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { ActiveUserData } from "../interfaces/active-user-data.interface";
import { ApiKeyService } from '../services/api-key.service';
import { AuthenticationService } from '../services/authentication.service';


// @Auth(AuthType.None)
@Controller('iam')
@ApiTags("Solid Core")
// @UseGuards(ThrottlerGuard)
// @SkipThrottle({login: true, short: true, burst: true, sustained: true}) // disable all sets by default for this controller
export class AuthenticationController {
    private readonly logger = new Logger(AuthenticationController.name);

    constructor(
        private readonly authService: AuthenticationService,
        private readonly apiKeyService: ApiKeyService,
    ) { }

    @Public()
    // @SkipThrottle({ login: false, short: true, burst: true, sustained: true }) //Enable the login throttle only
    @Post('register')
    signUp(@Body() signUpDto: SignUpDto) {
        return this.authService.signUp(signUpDto);
    }

    @ApiBearerAuth("jwt")
    @Post('register-private')
    signUpPrivate(@Body() signUpDto: RegisterPrivateDto, @ActiveUser() activeUser: ActiveUserData) {
        return this.authService.signUp(signUpDto, activeUser);
    }

    @Public()
    // @SkipThrottle({ login: false, short: true, burst: true, sustained: true }) //Enable the login throttle only
    @HttpCode(HttpStatus.OK) // by default @Post does 201, we wanted 200 - hence using @HttpCode(HttpStatus.OK)
    @Post('authenticate')
    async signIn(
        @Res({ passthrough: true }) response: Response,
        @Body() signInDto: SignInDto
    ) {
        // This means that we are passing the token back in plain text. 
        // This is less secure. 
        // console.log("signInDto in Signin Controller", signInDto);

        return this.authService.signIn(signInDto);

        // This means we are setting the token as a http only cookie.
        // const accessToken = await this.authService.signIn(signInDto);
        // response.cookie('accessToken', accessToken, {
        //     secure: true,
        //     httpOnly: true,
        //     sameSite: true,
        //   });
    }

    @Public()
    // @SkipThrottle({ login: false, short: true, burst: true, sustained: true }) //Enable the login throttle only
    @HttpCode(HttpStatus.OK) // changed since the default is 201
    @Post('refresh-tokens')
    refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
        return this.authService.refreshTokens(refreshTokenDto);
    }

    @Public()
    // @SkipThrottle({ login: false, short: true, burst: true, sustained: true }) //Enable the login throttle only
    @Post('initiate/forgot-password')
    initiateForgotPassword(@Body() initiateForgotPasswordDto: InitiateForgotPasswordDto) {
        return this.authService.initiateForgotPassword(initiateForgotPasswordDto);
    }

    @Public()
    // @SkipThrottle({ login: false, short: true, burst: true, sustained: true }) //Enable the login throttle only
    @Post('confirm/forgot-password')
    confirmForgotPassword(@Body() confirmForgotPasswordDto: ConfirmForgotPasswordDto) {
        return this.authService.confirmForgotPassword(confirmForgotPasswordDto);
    }

    @ApiBearerAuth("jwt")
    @Post('change-password')
    changePassword(@Body() changePasswordDto: ChangePasswordDto, @ActiveUser() activeUser: ActiveUserData) {
        return this.authService.changePassword(changePasswordDto, activeUser);
    }

    @ApiBearerAuth("jwt")
    @Get('me')
    me(
        @ActiveUser() activeUser: ActiveUserData
    ) {
        return this.authService.me(activeUser);
    }

    @ApiBearerAuth("jwt")
    @Post('logout')
    @Public()
    @HttpCode(HttpStatus.OK)
    async logout(@Body('refreshToken') refreshToken: string) {
        return this.authService.logout(refreshToken);
    }

    @ApiBearerAuth("jwt")
    @Post('api-keys')
    @HttpCode(HttpStatus.CREATED)
    generateApiKey(
        @Body() dto: CreateApiKeyDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.apiKeyService.generate(activeUser.sub, dto);
    }

    @ApiBearerAuth("jwt")
    @Post('api-keys/users/:userId')
    @HttpCode(HttpStatus.CREATED)
    generateApiKeyForUser(
        @Param('userId', ParseIntPipe) userId: number,
        @Body() dto: CreateApiKeyDto,
    ) {
        return this.apiKeyService.generate(userId, dto);
    }

    @ApiBearerAuth("jwt")
    @Patch('api-keys/:id')
    @HttpCode(HttpStatus.OK)
    updateApiKey(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateApiKeyDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.apiKeyService.updateKey(id, activeUser.sub, dto);
    }

    @Public()
    @ApiQuery({ name: 'apiKey', required: true, type: String })
    @Get('api-keys/me')
    async apiKeyMe(@Query() query: any) { 
        return this.apiKeyService.apiKeyMe(query);  
    }

    @Post('sso/code')
    @HttpCode(HttpStatus.OK)
    generateSsoCode(
        @ActiveUser() activeUser: ActiveUserData,   
        @Headers('authorization') authorization: string,
    ) {
        const rawAccessToken = authorization?.replace(/^Bearer\s+/i, '');
        return this.authService.generateSsoCode(activeUser, rawAccessToken);
    }

    @Public()
    @Post('sso/exchange')
    @HttpCode(HttpStatus.OK)
    exchangeSsoCode(@Body() ssoExchangeDto: SsoExchangeDto) {
        return this.authService.exchangeSsoCode(ssoExchangeDto.code);
    }
}
