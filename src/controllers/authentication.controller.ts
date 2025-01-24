import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Res, UseGuards } from '@nestjs/common';
import { AuthenticationService } from '../services/authentication.service';
import { SignInDto } from '../dtos/sign-in.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { Response } from 'express';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard } from '../passport-strategies/local.strategy';
import { Public } from '../decorators/public.decorator';
import { InitiateForgotPasswordDto } from '../dtos/initiate-forgot-password.dto';
import { ConfirmForgotPasswordDto } from '../dtos/confirm-forgot-password.dto';
import { ChangePasswordDto } from "../dtos/change-password.dto";
import { ActiveUser } from "../decorators/active-user.decorator";
import { ActiveUserData } from "../interfaces/active-user-data.interface";
import { RegisterPrivateDto } from '../dtos/register-private.dto';


// @Auth(AuthType.None)
@Controller('iam')
@ApiTags("Iam")
export class AuthenticationController {
    private readonly logger = new Logger(AuthenticationController.name);

    constructor(private readonly authService: AuthenticationService) { }

    @Public()
    @Post('register')
    signUp(@Body() signUpDto: SignUpDto) {
        return this.authService.signUp(signUpDto);
    }

    @ApiBearerAuth("jwt")
    @Post('register-private')
    signUpPrivate(@Body() signUpDto: SignUpDto, @ActiveUser() activeUser: ActiveUserData) {
        return this.authService.signUp(signUpDto, activeUser);
    }

    @Public()
    // @UseGuards(LocalAuthGuard)
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
    @HttpCode(HttpStatus.OK) // changed since the default is 201
    @Post('refresh-tokens')
    refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
        return this.authService.refreshTokens(refreshTokenDto);
    }

    @Public()
    @Post('initiate/forgot-password')
    initiateForgotPassword(@Body() initiateForgotPasswordDto: InitiateForgotPasswordDto) {
        return this.authService.initiateForgotPassword(initiateForgotPasswordDto);
    }

    @Public()
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
    @HttpCode(HttpStatus.OK)
    async logout() {
        return this.authService.logout();
    }
}
