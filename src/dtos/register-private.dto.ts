import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterPrivateDto {
    @IsNotEmpty()
    username: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsOptional()
    mobile?: string;

    @IsOptional()
    @MinLength(10)
    password?: string;
}
