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

type Source = 'self' | 'none' | string; // string = an origin like 'https://cdn.example.com'
type DirectiveConfig = 'self' | 'none' | Source[];

export type PermissionsPolicyConfig = Record<string, DirectiveConfig>;

export const DEFAULT_PERMISSIONS_POLICY: PermissionsPolicyConfig = {
  camera: 'none',
  microphone: 'none',
  geolocation: 'none',
  fullscreen: 'self',             // allow same-origin fullscreen
  payment: 'none',
  accelerometer: 'none',
  autoplay: 'none',
  'clipboard-read': 'none',
  'clipboard-write': 'none',
  gyroscope: 'none',
  magnetometer: 'none',
  usb: 'none',
};

export function buildPermissionsPolicyHeader(
  overrides: Partial<PermissionsPolicyConfig> = {}
): string {
  const merged: PermissionsPolicyConfig = { ...DEFAULT_PERMISSIONS_POLICY, ...overrides };
  return Object.entries(merged)
    .map(([feature, value]) => `${feature}=${serializeValue(value)}`)
    .join(', ');
}

function serializeValue(v: DirectiveConfig): string {
  if (v === 'none') return '()';
  if (v === 'self') return '(self)';
  // array of sources: allow 'self' and/or explicit origins
  const parts = v.map(src => (src === 'self' ? 'self' : src)).join(' ');
  return `(${parts})`;
}
