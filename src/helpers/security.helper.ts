import { HelmetOptions } from "helmet";
import { Environment } from "src/decorators/disallow-in-production.decorator";

/**
 * Default security headers for SolidX apps.
 * - HSTS only in prod over HTTPS
 * - CSP with frame-ancestors 'none' (prevents clickjacking)
 * - X-Frame-Options: DENY (legacy fallback)
 * - No X-XSS-Protection (deprecated)
 */
export function buildDefaultSecurityHeaderOptions(): Readonly<HelmetOptions> {
  const isProd = process.env.ENV === Environment.Production;

  return {
    // Modern CSP. Add more directives as your app needs (script-src, connect-src, etc.)
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // sensible secure defaults
        // "default-src": ["'self'"],
        // "base-uri": ["'self'"],
        // "object-src": ["'none'"],
        // "form-action": ["'self'"],

        // clickjacking defense (modern)
        "frame-ancestors": ["'none'"],

        // add/adjust as needed for your app:
        // "script-src": ["'self'"],              // add hashes/nonces/CSPRO if needed
        // "style-src": ["'self'", "'unsafe-inline'"],
        // "img-src": ["'self'", "data:"],
        // "connect-src": ["'self'", "https://api.example.com"],
        // "frame-src": ["'none'"],               // iframes you intentionally allow
      },
    },

    
    // Legacy clickjacking defense (kept for older UAs)
    frameguard: { action: "deny" },

    // Referrer/cross-origin policies
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },

    // HSTS only when you’re on HTTPS in production
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  };
}

/* ---------------- Permissions-Policy (formerly Feature-Policy) ---------------- */

type Source = "self" | "none" | string;
type DirectiveConfig = "self" | "none" | Source[];
export type PermissionsPolicyConfig = Record<string, DirectiveConfig>;

export const DEFAULT_PERMISSIONS_POLICY: PermissionsPolicyConfig = {
  camera: "none",
  microphone: "none",
  geolocation: "none",
  fullscreen: "self",
  payment: "none",
  accelerometer: "none",
  autoplay: "none",
  "clipboard-read": "none",
  "clipboard-write": "none",
  gyroscope: "none",
  magnetometer: "none",
  usb: "none",
};

export function buildPermissionsPolicyHeader(
  overrides: Partial<PermissionsPolicyConfig> = {}
): string {
  const merged: PermissionsPolicyConfig = { ...DEFAULT_PERMISSIONS_POLICY, ...overrides };
  return Object.entries(merged)
    .map(([feature, value]) => `${feature}=${serializeValue(value)}`)
    .join(", ");
}

function serializeValue(v: DirectiveConfig): string {
  if (v === "none") return "()";
  if (v === "self") return "(self)";
  const parts = v.map((src) => (src === "self" ? "self" : src)).join(" ");
  return `(${parts})`;
}

/* ---------------- Cache-Control helpers ---------------- */

/**
 * Default: no-store for HTML/API responses unless you have a reason to cache.
 * Attach as a global middleware or on selected routes.
 */
export const DEFAULT_CACHE_CONTROL =
  "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0";

export function setDefaultCacheControl() {
  return function cacheControlMiddleware(
    _req: import("express").Request,
    _res: import("express").Response,
    next: import("express").NextFunction
  ) {
    _res.setHeader("Cache-Control", DEFAULT_CACHE_CONTROL);
    next();
  };
}

/* ---------------- Example Express wiring ---------------- */
// import express from "express";
// const app = express();
// app.use(helmet(buildDefaultSecurityHeaderOptions()));
// app.use((req, res, next) => {
//   res.setHeader("Permissions-Policy", buildPermissionsPolicyHeader());
//   next();
// });
// app.use(setDefaultCacheControl());