import { IsBoolean, IsOptional } from 'class-validator';
import { SignUpDto } from './sign-up.dto';

export class RegisterPrivateDto extends SignUpDto {
    @IsBoolean()
    @IsOptional()
    isAllowedToGenerateApiKeys?: boolean;
}
