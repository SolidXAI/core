export declare enum SignInType {
    email = "email",
    mobile = "mobile"
}
export declare class OTPConfirmOTPDto {
    type: string;
    identifier: string;
    otp: string;
}
