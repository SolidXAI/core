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
    forcePasswordChange: boolean;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    lastLoginProvider: string;
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
    active: boolean;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    forgotPasswordConfirmedAt: Date;
    @IsOptional()
    @IsString()
    @ApiProperty()
    verificationTokenOnForgotPassword: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    verificationTokenOnForgotPasswordExpiresAt: Date;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerifiedOnRegistrationAt: Date;
    @IsOptional()
    @IsString()
    @ApiProperty()
    emailVerificationTokenOnRegistration: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerificationTokenOnRegistrationExpiresAt: Date;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerifiedOnRegistrationAt: Date;
    @IsOptional()
    @IsString()
    @ApiProperty()
    mobileVerificationTokenOnRegistration: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerificationTokenOnRegistrationExpiresAt: Date;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerifiedOnLoginAt: Date;
    @IsOptional()
    @IsString()
    @ApiProperty()
    emailVerificationTokenOnLogin: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    emailVerificationTokenOnLoginExpiresAt: Date;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerifiedOnLoginAt: Date;
    @IsOptional()
    @IsString()
    @ApiProperty()
    mobileVerificationTokenOnLogin: string;
    @IsOptional()
    @IsDate()
    @ApiProperty()
    mobileVerificationTokenOnLoginExpiresAt: Date;
    @IsOptional()
    @IsString()
    @ApiProperty()
    customPayload: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isAllowedToGenerateApiKeys: boolean;
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