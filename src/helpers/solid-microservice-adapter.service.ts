import { Injectable, Logger, Scope } from '@nestjs/common';
import axios from 'axios';

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

    return response.data as SolidxIamAuthResponse;
  }
}
