import { CorsOptions } from 'cors';
import { ConfigService } from '@nestjs/config';

/** Build CorsOptions from env; supports wildcards like https://*.example.com */
export function buildDefaultCorsOptions(configService: ConfigService): CorsOptions {
  const rawOrigins = configService.get<string>('CORS_ORIGINS') ?? '';
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
  const isAllowed = (origin: string) =>
    matchers.length > 0 && matchers.some(rx => rx.test(origin));

  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);           // allow no-origin (CLI/mobile/internal)
      if (isAllowed(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };
}