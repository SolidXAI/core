
import { Logger as TypeORMLogger, QueryRunner } from 'typeorm';
import { Logger } from 'winston';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as winston from 'winston';
import { Environment } from './decorators/disallow-in-production.decorator';

export const createWinstonLoggerConfig = () => ({
    level: process.env.LOG_LEVEL || (process.env.ENV === Environment.Production ? 'warn' : 'info'),
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp }) => {
            if (!message) {
                return `[${timestamp}] ${level.toUpperCase()}: (No message provided)`;
            }
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        }),
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.printf(({ level, message, timestamp }) => {
                    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
                }),
            ),
        }),
        new winston.transports.File({
            filename: 'logs/application.log',
        }),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
    ],
});

export const WinstonLoggerConfig = createWinstonLoggerConfig();

export class WinstonTypeORMLogger implements TypeORMLogger {
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) { }

    logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        if (Boolean(process.env.DEFAULT_DATABASE_LOGGING)) {
            this.logger.info(`Query: ${query} Parameters: ${parameters}`);
        }
    }

    logQueryError(error: string, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        this.logger.error(`Query failed: ${error} | Query: ${query} | Parameters: ${parameters}`);
    }

    logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        this.logger.warn(`Slow query: ${time}ms | Query: ${query} | Parameters: ${parameters}`);
    }

    logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
        this.logger.info(`Schema Build: ${message}`);
    }

    logMigration(message: string, queryRunner?: QueryRunner): void {
        this.logger.info(`Migration: ${message}`);
    }

    log(level: 'log' | 'info' | 'warn' | 'error', message: any): void {
        this.logger[level](message);
    }
}