import { Environment } from "src/decorators/disallow-in-production.decorator";
import { HelmetOptions } from "helmet"; 

export function buildDefaultSecurityHeaderOptions(): Readonly<HelmetOptions> {
    return {
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    frameguard: { action: 'sameorigin' }, // or { action: 'deny' }
    // HSTS: send only in prod over HTTPS
    hsts:
      process.env.NODE_ENV === Environment.Production
        ? { maxAge: 31536000, includeSubDomains: true, preload: true } // 1 year
        : false,
  }
}