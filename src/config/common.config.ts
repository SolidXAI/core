import { registerAs } from '@nestjs/config';

export default registerAs('common', () => {
    return {
        emailProvider: process.env.COMMON_EMAIL_PROVIDER,
        emailTemplateSeederFiles: process.env.COMMON_EMAIL_TEMPLATE_SEEDER_FILES,
        smsProvider: process.env.COMMON_SMS_PROVIDER,
        smsTemplateSeederFiles: process.env.COMMON_SMS_TEMPLATE_SEEDER_FILES,
        shouldQueueEmails: (process.env.COMMON_EMAIL_SHOULD_QUEUE ?? 'false') === 'true',
        shouldQueueSms: (process.env.COMMON_SMS_SHOULD_QUEUE ?? 'false') === 'true',
        smtpMail: {
            host: process.env.COMMON_SMTP_EMAIL_SMTP_HOST,
            port: +(process.env.COMMON_SMTP_EMAIL_SMTP_PORT ?? 587),
            username: process.env.COMMON_SMTP_EMAIL_USERNAME,
            password: process.env.COMMON_SMTP_EMAIL_PASSWORD,
            from: process.env.COMMON_SMTP_EMAIL_FROM,
        },
        apiMail: {
            key: process.env.COMMON_API_EMAIL_KEY
        },
        msg91Sms: {
            url: process.env.COMMON_MSG91_SMS_URL,
            apiKey: process.env.COMMON_MSG91_SMS_API_KEY,
        },
        shortUrl: {
            apiUrl: process.env.COMMON_SHORT_URL_API_URL,
            apiKey: process.env.COMMON_SHORT_URL_API_KEY,
            domain: process.env.COMMON_SHORT_URL_DOMAIN,
            enabled: (process.env.COMMON_SHORT_URL_ENABLED ?? 'false') === 'true',
        },
        msg91Whatsapp: {
            url: process.env.COMMON_WHATSAPP_API_URL,
            apiKey: process.env.COMMON_WHATSAPP_API_KEY,
            integratedNumber: process.env.COMMON_WHATSAPP_INTEGRATED_NUMBER
        },
        awsS3Credentials: {
            S3_AWS_ACCESS_KEY: process.env.S3_AWS_ACCESS_KEY,
            S3_AWS_SECRET_KEY: process.env.S3_AWS_SECRET_KEY,
            S3_AWS_REGION_NAME: process.env.S3_AWS_REGION_NAME
        }
    };
});

export interface AwsS3Config {
    S3_AWS_ACCESS_KEY: string;
    S3_AWS_SECRET_KEY: string;
    S3_AWS_REGION_NAME: string;
}
