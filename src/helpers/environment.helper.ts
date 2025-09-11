import { ConfigService } from "@nestjs/config";
import { isNumber } from 'class-validator';

export function parseBooleanEnv(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }
    return value.toLowerCase() === 'true';
}

export function isRedisConfigured(configService: ConfigService): boolean {
    const host = configService.get<string>('REDIS_HOST');
    const port = configService.get<string>('REDIS_PORT');
    return host && port && isNumber(parseInt(port));
}