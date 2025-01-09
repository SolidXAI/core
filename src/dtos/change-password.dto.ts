import { IsNotEmpty } from "class-validator";

export class ChangePasswordDto {
    @IsNotEmpty()
    id: number;

    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    currentPassword: string;

    @IsNotEmpty()
    newPassword: string;
}