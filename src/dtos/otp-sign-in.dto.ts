import { IsEnum, IsNotEmpty } from "class-validator";
import { SignInType } from "./otp-confirm-otp.dto";

export class OTPSignInDto {
    @IsEnum(SignInType)
    @IsNotEmpty()
    type: string;

    @IsNotEmpty()
    identifier: string;
}