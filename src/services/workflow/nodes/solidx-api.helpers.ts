import { BadRequestException } from '@nestjs/common';

export type SolidXCrudOperation =
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'patch'
  | 'delete';

export interface SolidXRequestOptions {
  apiBaseUrl: string;
  path: string;
  method: string;
  accessToken?: string;
  headers?: Record<string, any>;
  query?: any;
  body?: any;
  timeoutMs?: number;
}

export interface SolidXRequestResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  raw: any;
  uri: string;
  method: string;
}

export async function executeSolidXRequest(
  options: SolidXRequestOptions,
): Promise<SolidXRequestResult> {
  const fetchImpl = globalThis.fetch;
  if (!fetchImpl) {
    throw new BadRequestException('global fetch is not available.');
  }

  const uri = buildSolidXUri(options.apiBaseUrl, options.path, options.query);
  const headers = normalizeHeaders(options.headers);

  if (options.accessToken) {
    setHeaderIfMissing(headers, 'Authorization', `Bearer ${options.accessToken}`);
  }

  let body: any;
  if (options.body !== undefined && options.body !== null) {
    setHeaderIfMissing(headers, 'Content-Type', 'application/json');
    body =
      typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30000,
  );

  try {
    const response = await fetchImpl(uri, {
      method: options.method,
      headers,
      body,
      signal: controller.signal,
    } as any);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const text = await response.text();
    const parsed = parseBody(text);

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: unwrapSolidXData(parsed),
      raw: parsed,
      uri,
      method: options.method,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildSolidXPath(model: string, id?: any): string {
  const normalizedModel = normalizeModelPath(model);
  if (!normalizedModel) {
    throw new BadRequestException('SolidX model is required.');
  }

  if (id === undefined || id === null || id === '') {
    return normalizedModel;
  }

  return `${normalizedModel}/${encodeURIComponent(String(id))}`;
}

export function normalizeModelPath(model: string): string {
  return String(model ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/^api\//i, '')
    .replace(/\/+$/, '');
}

function buildSolidXUri(apiBaseUrl: string, path: string, query: any): string {
  if (!apiBaseUrl) {
    throw new BadRequestException('SolidX API base URL is required.');
  }

  const base = String(apiBaseUrl).trim().replace(/\/+$/, '');
  const normalizedPath = String(path ?? '').replace(/^\/+/, '');
  const url = new URL(`${base}/api/${normalizedPath}`);

  appendQuery(url, query);
  return url.toString();
}

function appendQuery(url: URL, query: any) {
  if (!query || typeof query !== 'object') {
    return;
  }

  const appendValue = (key: string, value: any) => {
    if (!key || value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => appendValue(key, item));
      return;
    }
    if (typeof value === 'object') {
      url.searchParams.append(key, JSON.stringify(value));
      return;
    }
    url.searchParams.append(key, String(value));
  };

  if (Array.isArray(query)) {
    query.forEach((item) => {
      appendValue(String(item?.key ?? item?.name ?? ''), item?.value);
    });
    return;
  }

  Object.entries(query).forEach(([key, value]) => appendValue(key, value));
}

function normalizeHeaders(headers: any): Record<string, string> {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }

  return Object.entries(headers).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }
      acc[key] = String(value);
      return acc;
    },
    {},
  );
}

function setHeaderIfMissing(
  headers: Record<string, string>,
  name: string,
  value: string,
) {
  const existingKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  if (!existingKey) {
    headers[name] = value;
  }
}

function parseBody(text: string): any {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapSolidXData(body: any): any {
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data;
  }
  return body;
}
