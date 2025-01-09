export declare const iamConfig: (() => {
    passwordlessRegistration: boolean;
    passwordlessRegistrationValidateWhat: string[];
    allowPublicRegistration: boolean;
    activateUserOnRegistration: boolean;
    autoLoginUserOnRegistration: boolean;
    otpExpiry: number;
    defaultRole: string;
    dummyOtp: string;
    forgotPasswordSendVerificationTokenOn: string;
    googleOauth: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        redirectURL: string;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    passwordlessRegistration: boolean;
    passwordlessRegistrationValidateWhat: string[];
    allowPublicRegistration: boolean;
    activateUserOnRegistration: boolean;
    autoLoginUserOnRegistration: boolean;
    otpExpiry: number;
    defaultRole: string;
    dummyOtp: string;
    forgotPasswordSendVerificationTokenOn: string;
    googleOauth: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        redirectURL: string;
    };
}>;
export declare const jwtConfig: (() => {
    secret: string;
    audience: string;
    issuer: string;
    accessTokenTtl: number;
    refreshTokenTtl: number;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    secret: string;
    audience: string;
    issuer: string;
    accessTokenTtl: number;
    refreshTokenTtl: number;
}>;
