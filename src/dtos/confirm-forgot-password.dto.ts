import { IsNotEmpty, IsOptional } from "class-validator";
import { SolidPasswordRegex } from "src/decorators/solid-password.decorator";

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
    @SolidPasswordRegex({ regex: /^$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/, message: 'Password must contain at least one uppercase, one lowercase, one number, and one special character.' })
    password: string;
}