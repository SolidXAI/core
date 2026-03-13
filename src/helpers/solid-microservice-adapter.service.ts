import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import axios from 'axios';
import { Cache } from 'cache-manager';

export interface SolidxIamAuthRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface SolidxIamUser {
  email: string;
  mobile: string;
  username: string;
  forcePasswordChange: boolean;
  id: number;
  roles: string[];
}

export interface SolidxIamAuthData {
  user: SolidxIamUser;
  accessToken: string;
  refreshToken: string;
}

export interface SolidxIamAuthResponse {
  statusCode: number;
  message: string[];
  error: string;
  data: SolidxIamAuthData;
}

@Injectable({ scope: Scope.TRANSIENT })
export class SolidMicroserviceAdapter {
  private readonly logger = new Logger(SolidMicroserviceAdapter.name);
  private baseUrl?: string;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  setBaseUrl(baseUrl: string): this {
    this.baseUrl = baseUrl;
    return this;
  }

  async authenticate({ email, username, password }: SolidxIamAuthRequest): Promise<SolidxIamAuthResponse> {
    if (!password) {
      throw new Error('password is required for IAM authentication');
    }
    if (!email && !username) {
      throw new Error('email or username is required for IAM authentication');
    }

    const cacheKey = this.getAuthCacheKey(email, username);
    const cachedResponse = (await this.cacheManager.get(cacheKey)) as SolidxIamAuthResponse | undefined;
    if (cachedResponse) {
      this.logger.debug(`IAM auth cache hit for ${cacheKey}`);
      return cachedResponse;
    }
    this.logger.debug(`IAM auth cache miss for ${cacheKey}`);

    if (!this.baseUrl) {
      throw new Error('baseUrl must be set before IAM authentication');
    }

    const payload: SolidxIamAuthRequest = { password };
    if (email) payload.email = email;
    if (username) payload.username = username;

    this.logger.debug(`Requesting IAM access token from ${this.baseUrl}/api/iam/authenticate`);

    const response = await axios.post(`${this.baseUrl}/api/iam/authenticate`, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseData = response.data as SolidxIamAuthResponse;
    const ttlSeconds = this.getJwtTtlSeconds(responseData?.data?.accessToken);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.cacheManager.set(cacheKey, responseData, ttlSeconds);
    }

    return responseData;
  }

  private getAuthCacheKey(email?: string, username?: string): string {
    return `iam-auth:${email ?? ''}:${username ?? ''}`;
  }

  private getJwtTtlSeconds(accessToken?: string): number | undefined {
    if (!accessToken) return undefined;
    const parts = accessToken.split('.');
    if (parts.length < 2) return undefined;
    try {
      const payloadJson = Buffer.from(this.base64UrlToBase64(parts[1]), 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson) as { exp?: number };
      if (!payload?.exp || typeof payload.exp !== 'number') return undefined;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ttl = payload.exp - nowSeconds - 10;
      return ttl > 0 ? ttl : undefined;
    } catch {
      return undefined;
    }
  }

  private base64UrlToBase64(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    return normalized + '='.repeat(padLength);
  }
}
