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

  return {
    origin: (origin, cb) => {
      if (!origin) {
        logger.debug('CORS origin callback skipped regex evaluation because origin was empty');
        // allow no-origin (CLI/mobile/internal)
        return cb(null, true);
      }

      const matchingRegex = matchers.find(rx => rx.test(origin));
      if (matchingRegex) {
        logger.debug(`CORS origin matched: origin=${origin}; regex=${matchingRegex.toString()}`);
        return cb(null, true);
      }

      logger.debug(`CORS origin did not match any regex: origin=${origin}; regexes=${matchers.map(r => r.toString()).join(', ')}`);
      return cb(new Error(`Origin ${origin} not allowed by CORS. Allowed origins: ${allowed.join(', ')}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };
}


// [2026-04-07T08:27:19.943Z] INFO: CORS allowed origins: leadyatra.indusindnipponlife.com
// [2026-04-07T08:27:19.944Z] INFO: CORS regexes: /^https?:\/\/leadyatra\.indusindnipponlife\.com(?::\d+)?$/i
// [2026-04-07T08:27:19.947Z] DEBUG: Mounting ClsMiddleware to *
// [2026-04-07T08:27:19.950Z] INFO: CityMasterController {/api/city-master}:
