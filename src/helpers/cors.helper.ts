import { CorsOptions } from 'cors';

/** Build CorsOptions from env; supports wildcards like https://*.example.com */
export function buildDefaultCorsOptions(): CorsOptions {
  const rawOrigins = process.env.SECURITY_CORS_ORIGINS ?? '*';

  const allowed = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);

  const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patternToRegex = (pattern: string): RegExp => {
    if (pattern === '*' || pattern === '.*') return /^.*$/i;
    // Strip scheme and split on wildcards BEFORE escaping so that escapeRx
    // never turns '*' into '\*', which would leave a stray backslash and
    // corrupt the character class when the wildcard is later substituted.
    const body = pattern
      .replace(/^https?:\/\//i, '')   // strip scheme (always re-added below)
      .split('*')                      // split on wildcards
      .map(escapeRx)                   // escape each literal segment
      .join('[^.]+');                  // rejoin with single-segment wildcard
    return new RegExp(`^https?:\\/\\/${body}(?::\\d+)?$`, 'i');
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