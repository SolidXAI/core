import { AuthenticationService } from '../services/authentication.service';
import { SignInDto } from '../dtos/sign-in.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { Response } from 'express';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { InitiateForgotPasswordDto } from '../dtos/initiate-forgot-password.dto';
import { ConfirmForgotPasswordDto } from '../dtos/confirm-forgot-password.dto';
import { ChangePasswordDto } from "../dtos/change-password.dto";
import { ActiveUserData } from "../interfaces/active-user-data.interface";
export declare class AuthenticationController {
    private readonly authService;
    private readonly logger;
    constructor(authService: AuthenticationService);
    signUp(signUpDto: SignUpDto): Promise<import("..").User>;
    signUpPrivate(signUpDto: SignUpDto, activeUser: ActiveUserData): Promise<import("..").User>;
    signIn(response: Response, signInDto: SignInDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            email: string;
            mobile: string;
            username: string;
            forcePasswordChange: boolean;
            id: number;
            roles: string[];
        };
    }>;
    refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    initiateForgotPassword(initiateForgotPasswordDto: InitiateForgotPasswordDto): Promise<{
        status: string;
        message: string;
        error: string;
        errorCode: string;
        data: {
            user: {
                email: string;
                mobile: string;
                username: string;
            };
        };
    }>;
    confirmForgotPassword(confirmForgotPasswordDto: ConfirmForgotPasswordDto): Promise<{
        status: string;
        message: string;
        error: string;
        errorCode: string;
        data: {};
    }>;
    changePassword(changePasswordDto: ChangePasswordDto, activeUser: ActiveUserData): Promise<boolean>;
    me(activeUser: ActiveUserData): Promise<{
        accessToken: string;
        refreshToken: string;
        fullName: string;
        username: string;
        email: string;
        mobile: string;
        password: string;
        forcePasswordChange: boolean;
        lastLoginProvider: string;
        accessCode: string;
        googleAccessToken: string;
        googleId: string;
        googleProfilePicture: string;
        active: boolean;
        forgotPasswordConfirmedAt: Date;
        verificationTokenOnForgotPassword: string;
        verificationTokenOnForgotPasswordExpiresAt: Date;
        emailVerifiedOnRegistrationAt: Date;
        emailVerificationTokenOnRegistration: string;
        emailVerificationTokenOnRegistrationExpiresAt: Date;
        mobileVerifiedOnRegistrationAt: Date;
        mobileVerificationTokenOnRegistration: string;
        mobileVerificationTokenOnRegistrationExpiresAt: Date;
        emailVerifiedOnLoginAt: Date;
        emailVerificationTokenOnLogin: string;
        emailVerificationTokenOnLoginExpiresAt: Date;
        mobileVerifiedOnLoginAt: Date;
        mobileVerificationTokenOnLogin: string;
        mobileVerificationTokenOnLoginExpiresAt: Date;
        customPayload: string;
        roles: import("..").RoleMetadata[];
        id: number;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
        deletedTracker: string;
    }>;
    logout(): Promise<void>;
}
