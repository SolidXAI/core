import { IsNotEmpty, IsOptional } from "class-validator";

export class ConfirmForgotPasswordDto {
    @IsNotEmpty()
    @IsOptional()
    username: string;

    @IsNotEmpty()
    @IsOptional()
    email: string;

    @IsNotEmpty()
    verificationToken: string;

    @IsNotEmpty()
    password: string;
}