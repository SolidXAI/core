import { Module } from '@nestjs/common';
import { SolidCoreCliDBModule } from './solid-core-cli-db.module';
import { SolidCoreModule } from './solid-core.module'; // Import main module
import { WinstonLoggerConfig } from './winston.logger';
import { WinstonModule } from 'nest-winston';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheOptions } from './config/cache.options';
import { ConfigModule } from '@nestjs/config';
import Joi from '@hapi/joi';

@Module({
  imports: [
    WinstonModule.forRoot(WinstonLoggerConfig),
    ConfigModule.forRoot({
      isGlobal: true,
      // Here we are specifying the path of the environment file.
      // If not specified then it assumes a file named .env
      // envFilePath: '.environment'

      // This we do in live environments, where these variables should ideally come 
      // from the OS provided environment.
      // ignoreEnvFile: true

      validationSchema: Joi.object({
        DEFAULT_DATABASE_HOST: Joi.required(),
        DEFAULT_DATABASE_PORT: Joi.number().default(5432),
      }),

      // load: [appConfig],
    }),

    SolidCoreCliDBModule,
    CacheModule.registerAsync(CacheOptions),
    EventEmitterModule.forRoot(),
    SolidCoreModule, // Import main module without exposing forRoot()
  ],
  exports: [SolidCoreModule], // Ensure CLI can use all exports
})
export class SolidCoreCliModule{}
