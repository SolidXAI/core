import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class InitiateForgotPasswordDto {

    @IsEmail()
    @IsOptional()
    email: string;

    @IsString()
    @IsOptional()
    username: string;

}