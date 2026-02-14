import type FormData from "form-data";

export interface ApiAdapterOptions {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  bodyText?: string;
  formData?: FormData;
}
