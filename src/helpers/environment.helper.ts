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

/**
 * Returns true when the project is configured to use an embedded PGlite
 * database with a single-connection pool. Several TypeORM subscriber and
 * code-generation workarounds are only necessary (and only applied) under
 * this constraint; on a regular multi-connection Postgres pool the original
 * behaviour is preserved.
 */
export function isEmbeddedDb(): boolean {
    return process.env.DEFAULT_DATABASE_DRIVER === 'pglite';
}