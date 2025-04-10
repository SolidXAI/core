import { IsInt, IsOptional, IsString, IsNotEmpty, Matches, IsBoolean, IsDate, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateRoleMetadataDto } from 'src/dtos/update-role-metadata.dto';
import { UpdateUserViewMetadataDto } from 'src/dtos/update-user-view-metadata.dto';

export class UpdateUserDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    fullName: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    username: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    email: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    mobile: string;
    @IsOptional()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/)
    @IsString()
    @ApiProperty()
    password: string;
    @IsOptional()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/)
    @IsString()
    @ApiProperty()
    passwordConfirm: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    forcePasswordChange: boolean = true;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    lastLoginProvider: string = "local";
    @IsOptional()
    @IsString()
    @ApiProperty()
    accessCode: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    googleAccessToken: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    googleId: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    googleProfilePicture: string;
    @IsNotEmpty()
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    active: boolean = true;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    forgotPasswordConfirmedAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsString()
    @ApiProperty()
    verificationTokenOnForgotPassword: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    verificationTokenOnForgotPasswordExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerifiedOnRegistrationAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsString()
    @ApiProperty()
    emailVerificationTokenOnRegistration: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerificationTokenOnRegistrationExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerifiedOnRegistrationAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsString()
    @ApiProperty()
    mobileVerificationTokenOnRegistration: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerificationTokenOnRegistrationExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerifiedOnLoginAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsString()
    @ApiProperty()
    emailVerificationTokenOnLogin: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerificationTokenOnLoginExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerifiedOnLoginAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsString()
    @ApiProperty()
    mobileVerificationTokenOnLogin: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerificationTokenOnLoginExpiresAt: Date = new Date("1970-01-01T00:00:00.000Z");
    @IsOptional()
    @IsString()
    @ApiProperty()
    customPayload: string;
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateRoleMetadataDto)
    roles: UpdateRoleMetadataDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    rolesIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    rolesCommand: string;
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateUserViewMetadataDto)
    userViewMetadata: UpdateUserViewMetadataDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    userViewMetadataIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    userViewMetadataCommand: string;
}