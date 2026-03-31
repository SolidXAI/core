import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import qs from 'qs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { WrapResponseInterceptor } from '../interceptors/wrap-response.interceptor';
import { buildDefaultCorsOptions } from './cors.helper';
import { buildDefaultSecurityHeaderOptions, buildPermissionsPolicyHeader, PermissionsPolicyConfig } from './security.helper';
import { parseBooleanEnv } from './environment.helper';

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
 * Bootstraps a SolidX NestJS application with sensible defaults:
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
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
  });

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
        depth: 10,
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
