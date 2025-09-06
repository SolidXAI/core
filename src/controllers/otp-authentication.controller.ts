import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Auth } from '../decorators/auth.decorator';
import { Public } from '../decorators/public.decorator';
import { OTPConfirmOTPDto } from '../dtos/otp-confirm-otp.dto';
import { OTPSignInDto } from '../dtos/otp-sign-in.dto';
import { OTPSignUpDto } from '../dtos/otp-sign-up.dto';
import { AuthType } from '../enums/auth-type.enum';
import { AuthenticationService } from '../services/authentication.service';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';


@Auth(AuthType.None)
@Controller('iam/otp')
@ApiTags("Iam")
@UseGuards(ThrottlerGuard)
@SkipThrottle({ login: false, short: true, burst: true, sustained: true }) //Enable the login throttle only
export class OTPAuthenticationController {
    constructor(private readonly authService: AuthenticationService) { }

    @Public()
    @Post('register/initiate')
    initiateRegistration(@Body() signUpDto: OTPSignUpDto) {
        return this.authService.otpInitiateRegistration(signUpDto); //TODO finalize if 200 or 201 to be returned
    }

    @Public()
    @HttpCode(HttpStatus.OK) // by default @Post does 201, we wanted 200 - hence using @HttpCode(HttpStatus.OK)
    @Post('register/confirm')
    async confirmRegistration(
        @Res({ passthrough: true }) response: Response,
        @Body() signInDto: OTPConfirmOTPDto
    ) {
        // This means that we are passing the token back in plain text. 
        // This is less secure. 
        return this.authService.otpConfirmRegistration(signInDto);
    }

    @Public()
    @Post('login/initiate')
    initiateLogin(@Body() signInDto: OTPSignInDto) {
        return this.authService.otpInitiateLogin(signInDto);
    }

    @Public()
    @HttpCode(HttpStatus.OK) // by default @Post does 201, we wanted 200 - hence using @HttpCode(HttpStatus.OK)
    @Post('login/confirm')
    async confirmLogin(
        @Res({ passthrough: true }) response: Response,
        @Body() signInDto: OTPConfirmOTPDto
    ) {
        // This means that we are passing the token back in plain text. 
        // This is less secure. 
        return this.authService.otpConfirmLogin(signInDto);

        // This means we are setting the token as a http only cookie.
        // const accessToken = await this.authService.signIn(signInDto);
        // response.cookie('accessToken', accessToken, {
        //     secure: true,
        //     httpOnly: true,
        //     sameSite: true,
        //   });
    }


}
