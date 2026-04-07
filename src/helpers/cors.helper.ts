import { Logger } from '@nestjs/common';
import { CorsOptions } from 'cors';

const logger = new Logger('CorsHelper');

/** Build CorsOptions from env; supports wildcards like https://*.example.com */
export function buildDefaultCorsOptions(): CorsOptions {
  const rawOrigins = process.env.SECURITY_CORS_ORIGINS ?? '*';
  logger.log(`CORS allowed origins: ${rawOrigins}`);

  const allowed = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);

  const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patternToRegex = (pattern: string): RegExp => {
    const hasScheme = /^https?:\/\//i.test(pattern);
    const schemePart = hasScheme ? '' : 'https?:\\/\\/';
    if (pattern === '*' || pattern === '.*') return /^.*$/i;
    const escaped = escapeRx(pattern)
      .replace(/^https?:\/\//i, '')      // strip scheme if present
      .replace(/\*/g, '[^.]+');          // * => one subdomain segment
    return new RegExp(`^${schemePart}${escaped}(?::\\d+)?$`, 'i');
  };

  const matchers = allowed.map(patternToRegex);
  logger.log(`CORS regexes: ${matchers.map(r => r.toString()).join(', ')}`);

  const isAllowed = (origin: string) =>
    matchers.length > 0 && matchers.some(rx => rx.test(origin));

  return {
    origin: (origin, cb) => {
      logger.debug(
        `CORS origin callback received origin=${origin ?? '<empty>'}; regex checks: ${matchers
          .map(rx => `${rx.toString()}=${origin ? rx.test(origin) : 'skipped'}`)
          .join(', ')}`,
      );

      if (!origin) return cb(null, true);           // allow no-origin (CLI/mobile/internal)
      if (isAllowed(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS. Allowed origins: ${allowed.join(', ')}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };
}
