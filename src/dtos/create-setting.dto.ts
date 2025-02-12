import { IsString } from 'class-validator';
import { IsOptional, IsBoolean } from 'class-validator';
export class CreateSettingDto {
@IsOptional()
@IsString()
authPagesLayout: string;

@IsOptional()
@IsString()
authPagesTheme: string;

@IsOptional()
@IsString()
appTitle: string;

@IsOptional()
@IsString()
appLogo: string;

@IsOptional()
@IsString()
appDescription: string;

@IsOptional()
@IsString()
appTnc: string;

@IsOptional()
@IsString()
appPrivacyPolicy: string;

@IsOptional()
@IsBoolean()
iamAllowPublicRegistration: boolean = false;

@IsOptional()
@IsBoolean()
iamPasswordRegistrationEnabled: boolean = false;

@IsOptional()
@IsBoolean()
iamPasswordLessRegistrationEnabled: boolean = false;

@IsOptional()
@IsBoolean()
iamActivateUserOnRegistration: boolean = false;

@IsOptional()
@IsString()
iamDefaultRole: string;

@IsOptional()
@IsBoolean()
iamGoogleOAuth: boolean = false;
}