import { IsNotEmpty } from "class-validator";
import { SolidPasswordRegex } from "src/decorators/solid-password.decorator";

export class ChangePasswordDto {
    @IsNotEmpty()
    id: number;

    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    currentPassword: string;

    @IsNotEmpty()
    @SolidPasswordRegex({ regex: /^$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$/})
    newPassword: string;
}