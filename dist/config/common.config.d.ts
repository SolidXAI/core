declare const _default: (() => {
    emailProvider: string;
    emailTemplateSeederFiles: string;
    smsProvider: string;
    smsTemplateSeederFiles: string;
    shouldQueueEmails: boolean;
    shouldQueueSms: boolean;
    smtpMail: {
        host: string;
        port: number;
        username: string;
        password: string;
        from: string;
    };
    apiMail: {
        key: string;
    };
    msg91Sms: {
        url: string;
        apiKey: string;
    };
    shortUrl: {
        apiUrl: string;
        apiKey: string;
        domain: string;
        enabled: boolean;
    };
    msg91Whatsapp: {
        url: string;
        apiKey: string;
        integratedNumber: string;
    };
    awsS3Credentials: {
        S3_AWS_ACCESS_KEY: string;
        S3_AWS_SECRET_KEY: string;
        S3_AWS_BUCKET_NAME: string;
        S3_AWS_REGION_HOST: string;
        S3_AWS_REGION_NAME: string;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    emailProvider: string;
    emailTemplateSeederFiles: string;
    smsProvider: string;
    smsTemplateSeederFiles: string;
    shouldQueueEmails: boolean;
    shouldQueueSms: boolean;
    smtpMail: {
        host: string;
        port: number;
        username: string;
        password: string;
        from: string;
    };
    apiMail: {
        key: string;
    };
    msg91Sms: {
        url: string;
        apiKey: string;
    };
    shortUrl: {
        apiUrl: string;
        apiKey: string;
        domain: string;
        enabled: boolean;
    };
    msg91Whatsapp: {
        url: string;
        apiKey: string;
        integratedNumber: string;
    };
    awsS3Credentials: {
        S3_AWS_ACCESS_KEY: string;
        S3_AWS_SECRET_KEY: string;
        S3_AWS_BUCKET_NAME: string;
        S3_AWS_REGION_HOST: string;
        S3_AWS_REGION_NAME: string;
    };
}>;
export default _default;
