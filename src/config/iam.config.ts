import { registerAs } from '@nestjs/config';

export const iamConfig = registerAs('iam', () => {
    return {
        passwordlessRegistration: (process.env.IAM_PASSWORD_LESS_REGISTRATION ?? 'false') === 'true',
        iamPasswordRegistrationEnabled: (process.env.IAM_PASSWORD_REGISTRATION_ENABLED ?? 'true') === 'true',
        passwordlessRegistrationValidateWhat: (process.env.IAM_PASSWORD_LESS_REGISTRATION_VALIDATE_WHAT ?? 'email').split(',').map((item) => item.trim()),
        allowPublicRegistration: (process.env.IAM_ALLOW_PUBLIC_REGISTRATION ?? 'true') === 'true',
        activateUserOnRegistration: (process.env.IAM_ACTIVATE_USER_ON_REGISTRATION ?? 'true') === 'true',
        autoLoginUserOnRegistration: (process.env.IAM_AUTO_LOGIN_USER_ON_REGISTRATION ?? 'false') === 'true',
        otpExpiry: parseInt(process.env.IAM_OTP_EXPIRY ?? '10'),
        defaultRole: process.env.IAM_DEFAULT_ROLE ?? 'Public',
        dummyOtp: process.env.IAM_OTP_DUMMY,
        forgotPasswordSendVerificationTokenOn: process.env.IAM_FORGOT_PASSWORD_SEND_VERIFICATION_TOKEN_ON ?? 'email',
        forceChangePasswordOnFirstLogin:true,
        PASSWORD_REGEX: process.env.PASSWORD_REGEX || '^$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\da-zA-Z]).*$',
        PASSWORD_COMPLEXITY_DESC : process.env.PASSWORD_COMPLEXITY_DESC || 'Password must contain at least one uppercase, one lowercase, one number, and one special character.',
        googleOauth: {
            clientID: process.env.IAM_GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: process.env.IAM_GOOGLE_OAUTH_CLIENT_SECRET,
            callbackURL: process.env.IAM_GOOGLE_OAUTH_CALLBACK_URL,
            redirectURL: process.env.IAM_GOOGLE_OAUTH_REDIRECT_URL,
        },
    };
})

export const jwtConfig = registerAs('jwt', () => {
    return {
        secret: process.env.IAM_JWT_SECRET,
        audience: process.env.IAM_JWT_TOKEN_AUDIENCE,
        issuer: process.env.IAM_JWT_TOKEN_ISSUER,
        accessTokenTtl: parseInt(process.env.IAM_JWT_ACCESS_TOKEN_TTL ?? '3600', 10),
        refreshTokenTtl: parseInt(process.env.IAM_JWT_REFRESH_TOKEN_TTL ?? '86400', 10),
    };
});
