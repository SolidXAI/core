import type { ApiRequestOptions } from "../../adapters/api/api.types";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { attachJson } from "../../reporter/attachments";
import qs from "qs";

type ApiRequestInput = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  bodyText?: string;
  // Extra query params (object or querystring).
  query?: Record<string, any> | string;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  // Only merge plain objects.
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(target: any, source: any): any {
  if (isPlainObject(target) && isPlainObject(source)) {
    // Clone target to avoid mutation.
    const out: Record<string, any> = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (key in out) {
        // Merge nested keys.
        out[key] = deepMerge(out[key], value);
      } else {
        // Add new keys.
        out[key] = value;
      }
    }
    // Return merged object.
    return out;
  }
  // For non-objects, source wins.
  return source;
}

function stripUndefined(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      out[key] = stripUndefined(val);
    }
    return out;
  }
  return value;
}

export function registerApiRequestStep(registry: StepRegistry): void {
  registry.register("api.request", async (ctx: TestContext, step: OpStep) => {
    if (!ctx.api) {
      throw new Error('Missing API adapter on context for op "api.request"');
    }

    const input = (step.with ?? {}) as ApiRequestInput;
    if (!input.method) {
      throw new Error('Missing "method" in step.with for op "api.request"');
    }
    if (!input.url) {
      throw new Error('Missing "url" in step.with for op "api.request"');
    }

    // Original URL (may include query).
    const rawUrl = input.url;

    // Detect absolute URLs by scheme.
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl);

    // Parse with base for relative URLs.
    const urlObj = new URL(rawUrl, "http://solid.local");

    // Parse URL query into object.
    const urlQuery = urlObj.search
      ? (qs.parse(urlObj.search, { ignoreQueryPrefix: true, allowDots: true, depth: 10 }) as Record<string, any>)
      : {}; // No query in URL.
    let stepQuery: Record<string, any> = {};
    if (input.query !== undefined) {
      stepQuery =
        typeof input.query === "string"
          // Parse query string.
          ? (qs.parse(input.query, { ignoreQueryPrefix: true, allowDots: true, depth: 10 }) as Record<string, any>)
          // Use object as-is.
          : (input.query as Record<string, any>);
    }

    // Step query overrides URL query.
    const mergedQuery = deepMerge(urlQuery, stepQuery);

    // Rebuild query string.
    const queryString = qs.stringify(mergedQuery, { addQueryPrefix: true, allowDots: true });

    // Apply merged query to URL.
    urlObj.search = queryString;
    const finalUrl = absolute
      // Preserve absolute URL.
      ? urlObj.toString()
      // Keep relative URL shape.
      : `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;

    const req: ApiRequestOptions = {
      method: input.method,
      url: finalUrl,
      headers: input.headers,
      json: input.json,
      bodyText: input.bodyText,
    };

    const startedAt = Date.now();
    const printApiLogs = ctx.options?.printApiLogs ?? false;
    const logName = `api.request ${req.method} ${finalUrl}`;
    const requestLog = stripUndefined({
      method: req.method,
      url: finalUrl,
      headers: req.headers,
      query: mergedQuery,
      queryString: urlObj.search ? urlObj.search.slice(1) : "",
      json: input.json,
      bodyText: input.bodyText,
    });

    let response;
    try {
      response = await ctx.api.http(req);
    } catch (err: any) {
      if (printApiLogs) {
        attachJson(ctx, logName, {
          request: requestLog,
          durationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }

    const durationMs = Date.now() - startedAt;
    ctx.last = { ...(ctx.last ?? {}), apiResponse: response };

    if (printApiLogs) {
      const responseLog = stripUndefined({
        status: response.status,
        headers: response.headers,
        bodyJson: response.bodyJson,
        bodyText: response.bodyJson === undefined ? response.bodyText : undefined,
      });
      attachJson(ctx, logName, {
        request: requestLog,
        response: responseLog,
        durationMs,
      });
    }

    return {
      status: response.status,
      headers: response.headers,
      bodyText: response.bodyText,
      bodyJson: response.bodyJson,
      body: response.bodyJson ?? response.bodyText,
    };
  });
}
