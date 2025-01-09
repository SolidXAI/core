import { IsInt, IsOptional, IsString, IsNotEmpty, Matches, IsBoolean, IsDate } from 'class-validator';
export class UpdateUserDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsOptional()
    @IsString()
    fullName: string;

    @IsNotEmpty()
    @IsString()
    username: string;

    @IsOptional()
    @IsString()
    email: string;

    @IsOptional()
    @IsString()
    mobile: string;

    @IsNotEmpty()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/)
    @IsString()
    password: string;

    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/)
    @IsNotEmpty()
    passwordConfirm: string;

    @IsOptional()
    @IsBoolean()
    forcePasswordChange: boolean = true;

    @IsNotEmpty()
    @IsString()
    lastLoginProvider: string = "local";

    @IsOptional()
    @IsString()
    accessCode: string;

    @IsOptional()
    @IsString()
    googleAccessToken: string;

    @IsOptional()
    @IsString()
    googleId: string;

    @IsOptional()
    @IsString()
    googleProfilePicture: string;

    @IsNotEmpty()
    @IsBoolean()
    active: boolean = true;

    @IsOptional()
    @IsDate()
    forgotPasswordConfirmedAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsString()
    verificationTokenOnForgotPassword: string;

    @IsOptional()
    @IsDate()
    verificationTokenOnForgotPasswordExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsDate()
    emailVerifiedOnRegistrationAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsString()
    emailVerificationTokenOnRegistration: string;

    @IsOptional()
    @IsDate()
    emailVerificationTokenOnRegistrationExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsDate()
    mobileVerifiedOnRegistrationAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsString()
    mobileVerificationTokenOnRegistration: string;

    @IsOptional()
    @IsDate()
    mobileVerificationTokenOnRegistrationExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsDate()
    emailVerifiedOnLoginAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsString()
    emailVerificationTokenOnLogin: string;

    @IsOptional()
    @IsDate()
    emailVerificationTokenOnLoginExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsDate()
    mobileVerifiedOnLoginAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsString()
    mobileVerificationTokenOnLogin: string;

    @IsOptional()
    @IsDate()
    mobileVerificationTokenOnLoginExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");

    @IsOptional()
    @IsString()
    customPayload: string;
}