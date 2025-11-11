import { registerAs } from '@nestjs/config';
import { Environment } from 'src/decorators/disallow-in-production.decorator';


export const jwtConfig = registerAs('jwt', () => {
    return {
        secret: process.env.IAM_JWT_SECRET,
        audience: process.env.IAM_JWT_TOKEN_AUDIENCE,
        issuer: process.env.IAM_JWT_TOKEN_ISSUER,
        accessTokenTtl: parseInt(process.env.IAM_JWT_ACCESS_TOKEN_TTL ?? (process.env.ENV as Environment) === Environment.Production ? '1200' : '86400', 10), // 20 minutes in prod, 1 day otherwise
        refreshTokenTtl: parseInt(process.env.IAM_JWT_REFRESH_TOKEN_TTL ?? '604800', 10), // 7 days
    };
});
