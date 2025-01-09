import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { SMTPEMailService } from 'src/services/mail/SMTPEmailService';
import { Msg91OTPService } from 'src/services/sms/Msg91OTPService';
import { Repository } from 'typeorm';
import { iamConfig, jwtConfig } from '../config/iam.config';
import { ChangePasswordDto } from "../dtos/change-password.dto";
import { ConfirmForgotPasswordDto } from '../dtos/confirm-forgot-password.dto';
import { InitiateForgotPasswordDto } from '../dtos/initiate-forgot-password.dto';
import { OTPConfirmOTPDto } from '../dtos/otp-confirm-otp.dto';
import { OTPSignInDto } from '../dtos/otp-sign-in.dto';
import { OTPSignUpDto } from '../dtos/otp-sign-up.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { SignInDto } from '../dtos/sign-in.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { UserPasswordHistory } from '../entities/user-password-history.entity';
import { User } from '../entities/user.entity';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { HashingService } from './hashing.service';
import { RefreshTokenIdsStorageService } from './refresh-token-ids-storage.service';
import { UserService } from './user.service';
export declare class AuthenticationService {
    private readonly userService;
    private readonly userRepository;
    private readonly userPasswordHistoryRepository;
    private readonly hashingService;
    private readonly jwtService;
    private readonly jwtConfiguration;
    private readonly iamConfiguration;
    private readonly refreshTokenIdsStorage;
    private readonly httpService;
    private readonly mailService;
    private readonly smsService;
    private readonly eventEmitter;
    private readonly logger;
    constructor(userService: UserService, userRepository: Repository<User>, userPasswordHistoryRepository: Repository<UserPasswordHistory>, hashingService: HashingService, jwtService: JwtService, jwtConfiguration: ConfigType<typeof jwtConfig>, iamConfiguration: ConfigType<typeof iamConfig>, refreshTokenIdsStorage: RefreshTokenIdsStorageService, httpService: HttpService, mailService: SMTPEMailService, smsService: Msg91OTPService, eventEmitter: EventEmitter2);
    resolveUser(username: string, email: string): Promise<User>;
    validateUser(signInDto: SignInDto): Promise<User>;
    signUp(signUpDto: SignUpDto, activeUser?: ActiveUserData): Promise<User>;
    generatePassword(length?: number): string;
    private notifyUserOnForcePasswordChange;
    otpInitiateRegistration(signUpDto: OTPSignUpDto): Promise<{
        message: string;
    }>;
    private createUser;
    private calculateVerificationSources;
    private populateVerificationTokens;
    private notifyUserOnOtpInitiateRegistration;
    otpConfirmRegistration(confirmSignUpDto: OTPConfirmOTPDto): Promise<{
        active: boolean;
        message: string;
    }>;
    private triggerRegistrationEvent;
    areRegistrationValidationSourcesVerified(user: User): boolean;
    private otp;
    signIn(signInDto: SignInDto): Promise<{
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
    otpInitiateLogin(signInDto: OTPSignInDto): Promise<{
        message: string;
    }>;
    private notifyUserOnOtpInititateLogin;
    otpConfirmLogin(confirmSignInDto: OTPConfirmOTPDto): Promise<{
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
    changePassword(changePasswordDto: ChangePasswordDto, activeUser: ActiveUserData): Promise<boolean>;
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
    private notifyUserOnForgotPassword;
    confirmForgotPassword(confirmForgotPasswordDto: ConfirmForgotPasswordDto): Promise<{
        status: string;
        message: string;
        error: string;
        errorCode: string;
        data: {};
    }>;
    private isPasswordDuplicate;
    private deleteOldPasswords;
    generateTokens(user: User): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private signToken;
    validateUserUsingGoogle(user: User): Promise<any>;
    signInUsingGoogle(accessCode: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private isPasswordlessRegistrationEnabled;
    logout(): Promise<void>;
    activateUser(userId: number): Promise<void>;
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
}
