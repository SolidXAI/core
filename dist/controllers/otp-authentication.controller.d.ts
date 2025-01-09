import { Response } from 'express';
import { OTPConfirmOTPDto } from '../dtos/otp-confirm-otp.dto';
import { OTPSignInDto } from '../dtos/otp-sign-in.dto';
import { OTPSignUpDto } from '../dtos/otp-sign-up.dto';
import { AuthenticationService } from '../services/authentication.service';
export declare class OTPAuthenticationController {
    private readonly authService;
    constructor(authService: AuthenticationService);
    initiateRegistration(signUpDto: OTPSignUpDto): Promise<{
        message: string;
    }>;
    confirmRegistration(response: Response, signInDto: OTPConfirmOTPDto): Promise<{
        active: boolean;
        message: string;
    }>;
    initiateLogin(signInDto: OTPSignInDto): Promise<{
        message: string;
    }>;
    confirmLogin(response: Response, signInDto: OTPConfirmOTPDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            username: string;
            email: string;
            mobile: string;
            lastLoginProvider: string;
            roles: string[];
        };
    }>;
}
