import axios from "axios";

import type { ApiResponse } from "../../contracts/runtime-context.types";
import type { ApiAdapterOptions, ApiRequestOptions } from "./api.types";

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(headers, name.toLowerCase());
}

export class ApiAdapter {
  private readonly baseUrl?: string;
  private readonly defaultHeaders?: Record<string, string>;

  constructor(opts?: ApiAdapterOptions) {
    this.baseUrl = opts?.baseUrl;
    this.defaultHeaders = opts?.defaultHeaders;
  }

  async http(req: ApiRequestOptions): Promise<ApiResponse> {
    const headers: Record<string, string> = {
      ...(this.defaultHeaders ?? {}),
      ...(req.headers ?? {}),
    };

    if (req.json !== undefined && !hasHeader(headers, "content-type")) {
      headers["content-type"] = "application/json";
    }

    const response = await axios.request({
      baseURL: this.baseUrl,
      url: req.url,
      method: req.method as any,
      headers,
      data: req.json !== undefined ? req.json : req.bodyText,
      responseType: "text",
      transformResponse: (data) => data,
      validateStatus: () => true,
    });

    const bodyText = typeof response.data === "string"
      ? response.data
      : String(response.data);
    const responseHeaders = Object.fromEntries(
      Object.entries(response.headers ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        Array.isArray(value) ? value.join(", ") : String(value),
      ]),
    ) as Record<string, string>;

    let bodyJson: unknown;
    const contentType = responseHeaders["content-type"] ?? "";
    if (contentType.toLowerCase().includes("application/json")) {
      try {
        bodyJson = JSON.parse(bodyText);
      } catch {
        // ignore parse errors
      }
    }

    if (bodyJson === undefined) {
      const trimmed = bodyText.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          bodyJson = JSON.parse(trimmed);
        } catch {
          // ignore parse errors
        }
      }
    }

    const apiResponse: ApiResponse = {
      status: response.status,
      headers: responseHeaders,
      bodyText,
      ...(bodyJson !== undefined ? { bodyJson } : {}),
    };

    return apiResponse;
  }
}
