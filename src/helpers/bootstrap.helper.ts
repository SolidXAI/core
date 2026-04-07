import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import qs from 'qs';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CommandFactory } from 'nest-commander';
import { WrapResponseInterceptor } from '../interceptors/wrap-response.interceptor';
import { buildDefaultCorsOptions } from './cors.helper';
import { buildDefaultSecurityHeaderOptions, buildPermissionsPolicyHeader, PermissionsPolicyConfig } from './security.helper';
import { parseBooleanEnv } from './environment.helper';

// ---- Shared process handlers ----

function registerGlobalProcessHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
  });

  // Suppress pg deprecation warning caused by TypeORM's internal query scheduling
  process.on('warning', (warning) => {
    if (warning.name === 'DeprecationWarning' && (warning.message.includes('client.query()') || warning.message.includes('punycode'))) {
      return;
    }
    console.warn(warning);
  });
}

// ---- HTTP server bootstrap ----

export interface SolidSwaggerOptions {
  title?: string;
  description?: string;
  version?: string;
}

export interface SolidBootstrapOptions {
  /** Global API prefix. Defaults to 'api'. Set to '' to disable. */
  globalPrefix?: string;
  /** Swagger configuration. Set to false to disable Swagger entirely. */
  swagger?: SolidSwaggerOptions | false;
  /** Permissions-Policy header overrides (merged with defaults). */
  permissionsPolicyOverrides?: Partial<PermissionsPolicyConfig>;
}

/**
 * Bootstraps a SolidX NestJS HTTP application with sensible defaults:
 * security headers, CORS, Winston logger, ValidationPipe,
 * WrapResponseInterceptor, qs deep query parsing, Swagger, and the
 * pg BIGINT type parser.
 *
 * @example
 * // main.ts
 * bootstrapSolidApp(() => AppModule.forRoot(), {
 *   swagger: { title: 'My API', description: 'My API description' },
 * });
 */
export async function bootstrapSolidApp(
  appModuleFactory: () => Promise<any>,
  options: SolidBootstrapOptions = {},
): Promise<void> {
  registerGlobalProcessHandlers();

  const { globalPrefix = 'api', swagger = {}, permissionsPolicyOverrides = {} } = options;

  const appModule = await appModuleFactory();
  const app = await NestFactory.create(appModule);

  const apiEnabled = parseBooleanEnv('API_ENABLED', true);

  if (!apiEnabled) {
    await app.init();
    app
      .get(WINSTON_MODULE_NEST_PROVIDER)
      .log('API server disabled via API_ENABLED=false. Skipping HTTP listen.', 'Bootstrap');
    return;
  }

  // Health check at root path
  const server = app.getHttpAdapter().getInstance();
  server.get('/', (_req, res) => res.status(200).send('SOLID OK'));

  // Security headers
  app.use(helmet(buildDefaultSecurityHeaderOptions()));

  // Permissions-Policy header
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', buildPermissionsPolicyHeader(permissionsPolicyOverrides));
    next();
  });

  // Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const port = process.env.PORT || 3000;

  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  // qs-based deep query parsing (dot notation, nested objects, arrays)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.query) {
      req.query = qs.parse(req.url.split('?')[1], {
        allowDots: true,
        depth: 20,
        arrayLimit: 100,
      });
    }
    next();
  });

  // Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  if (swagger !== false) {
    const { title = 'Solid Starters', description = 'Solid Starters API', version = '1.0' } = swagger;
    const swaggerConfig = new DocumentBuilder()
      .setTitle(title)
      .setDescription(description)
      .setVersion(version)
      .setExternalDoc('Postman Collection', '/docs-json')
      .addBearerAuth(
        {
          description: 'Please enter token in following format: Bearer <JWT>',
          name: 'Authorization',
          bearerFormat: 'Bearer',
          scheme: 'Bearer',
          type: 'http',
          in: 'Header',
        },
        'jwt',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('/docs', app, document);
  }

  // Global interceptor
  app.useGlobalInterceptors(new WrapResponseInterceptor());

  // CORS
  app.enableCors(buildDefaultCorsOptions());

  // Fix pg returning BIGINT columns as strings
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const types = require('pg').types;
  types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val));

  await app.listen(port);
}

// ---- CLI bootstrap ----

/**
 * Bootstraps a SolidX NestJS CLI application using nest-commander.
 * Handles verbose flag stripping, project root validation, and clean process exit.
 *
 * @example
 * // main-cli.ts
 * #!/usr/bin/env node
 * import { bootstrapSolidCli } from '@solidxai/core';
 * import { AppModule } from './app.module';
 *
 * bootstrapSolidCli(() => AppModule.forRoot());
 */
export async function bootstrapSolidCli(
  appModuleFactory: () => Promise<any>,
): Promise<void> {
  registerGlobalProcessHandlers();

  process.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Exiting with error status code: ${code}`);
    }
  });

  // Validate that cwd is a valid Solid API project
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.error('Does not seem to be a valid solid-api project.');
    console.error('Exit reason: missing package.json in the current directory.');
    process.exit(1);
  }

  // Strip --verbose / -v before nest-commander processes argv
  const showLogs = process.argv.includes('--verbose') || process.argv.includes('-v');
  for (const flag of ['--verbose', '-v']) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1) process.argv.splice(idx, 1);
  }

  const appModule = await appModuleFactory();
  process.env.SOLID_CLI_RUNNING = 'true';

  // @ts-ignore
  const app = await CommandFactory.createWithoutRunning(appModule, {
    logger: showLogs ? ['debug', 'error', 'fatal', 'log', 'verbose', 'warn'] : false,
  });

  try {
    await CommandFactory.runApplication(app);
  } catch (e) {
    console.error('CLI exited abruptly due to an error:', e);
    process.exit(1);
  }

  process.exit(0);
}
