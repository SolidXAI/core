import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {

    @IsString()
    @IsOptional()
    fullName?: string;

    @IsNotEmpty()
    username: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsOptional()
    password: string;

    @IsString()
    @IsOptional()
    mobile?: string;

    @IsOptional()
    @IsArray()
    @Type(() => String)
    roles?: string[];
}
