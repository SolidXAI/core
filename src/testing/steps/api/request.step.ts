import type { ApiRequestOptions } from "../../adapters/api/api.types";
import type { TestContext } from "../../contracts/runtime-context.types";
import type { OpStep } from "../../contracts/testing-metadata.types";
import { StepRegistry } from "../../core/step-registry";
import { attachJson } from "../../reporter/attachments";
import FormData from "form-data";
import crypto from "crypto";
import fs from "fs";
import https from "https";
import path from "path";
import qs from "qs";

const TMP_DIR = "/tmp/.solidx-testing-files";
const MAX_REDIRECTS = 5;

type ApiFormItem = {
  name: string;
  value: any;
  type?: "text" | "file";
  filename?: string;
  contentType?: string;
};

type ApiRequestInput = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  bodyText?: string;
  // Extra query params (object or querystring).
  query?: Record<string, any> | string;
  // Form data payload (array of items).
  formData?: ApiFormItem[] | Record<string, any>;
  // Alias for formData (array or object).
  body?: ApiFormItem[] | Record<string, any>;
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

function ensureTmpDir(): void {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function buildTempFilePath(urlObj: URL): string {
  const ext = path.extname(urlObj.pathname);
  const base = path.basename(urlObj.pathname, ext) || "file";
  const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, "_");
  const suffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  return path.join(TMP_DIR, `${safeBase}-${suffix}${ext}`);
}

function downloadUrlToFile(urlValue: string, redirectCount: number = 0): Promise<string> {
  if (!urlValue.startsWith("https://")) {
    throw new Error(`Only https URLs are allowed for file downloads: ${urlValue}`);
  }
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects while downloading file: ${urlValue}`);
  }

  const urlObj = new URL(urlValue);
  ensureTmpDir();
  const filePath = buildTempFilePath(urlObj);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filePath);

    const request = https.get(urlObj, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;

      if (status >= 300 && status < 400 && location) {
        response.resume();
        fileStream.close(() => fs.unlink(filePath, () => {}));
        const nextUrl = new URL(location, urlObj).toString();
        downloadUrlToFile(nextUrl, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (status >= 400) {
        response.resume();
        fileStream.close(() => fs.unlink(filePath, () => {}));
        reject(new Error(`Failed to download file. HTTP ${status}`));
        return;
      }

      response.pipe(fileStream);
    });

    request.on("error", (err) => {
      fileStream.close(() => fs.unlink(filePath, () => {}));
      reject(err);
    });

    fileStream.on("error", (err) => {
      request.destroy();
      fs.unlink(filePath, () => {});
      reject(err);
    });

    fileStream.on("finish", () => {
      fileStream.close(() => resolve(filePath));
    });
  });
}

function resolveFilePath(rawValue: string): string {
  const value = rawValue.startsWith("file:") ? rawValue.slice(5) : rawValue;
  if (!value) {
    throw new Error('Invalid file reference. Use "file:/absolute/path".');
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`File path must be absolute: ${value}`);
  }
  if (!fs.existsSync(value)) {
    throw new Error(`File does not exist: ${value}`);
  }
  return value;
}

async function resolveFileReference(rawValue: string): Promise<{ filePath: string; source: "file" | "url"; url?: string }>{
  if (rawValue.startsWith("url:")) {
    const urlValue = rawValue.slice(4);
    if (!urlValue) {
      throw new Error('Invalid url reference. Use "url:https://...".');
    }
    const filePath = await downloadUrlToFile(urlValue);
    return { filePath, source: "url", url: urlValue };
  }

  return { filePath: resolveFilePath(rawValue), source: "file" };
}

function formItemsFromRecord(record: Record<string, any>): ApiFormItem[] {
  return Object.entries(record).map(([name, value]) => {
    if (typeof value === "string" && (value.startsWith("file:") || value.startsWith("url:"))) {
      return { name, value, type: "file" };
    }
    return { name, value };
  });
}

async function buildFormData(items: ApiFormItem[]): Promise<{ form: FormData; logItems: Record<string, any>[] }>{
  const form = new FormData();
  const logItems: Record<string, any>[] = [];

  for (const item of items) {
    if (!item?.name) {
      throw new Error('Form item is missing required "name".');
    }
    const rawValue = item.value;
    const isFile = item.type === "file" || (typeof rawValue === "string" && (rawValue.startsWith("file:") || rawValue.startsWith("url:")));

    if (isFile) {
      if (typeof rawValue !== "string") {
        throw new Error(`Form file value must be a string for field: ${item.name}`);
      }
      const resolved = await resolveFileReference(rawValue);
      const filename = item.filename ?? path.basename(resolved.filePath);
      form.append(item.name, fs.createReadStream(resolved.filePath), {
        filename,
        contentType: item.contentType,
      });
      logItems.push({
        name: item.name,
        type: "file",
        source: resolved.source,
        url: resolved.url,
        path: resolved.filePath,
        filename,
        contentType: item.contentType,
      });
    } else {
      // TODO: Need to test the JSON.stringify(rawValue) functionality here...
      // This scenario will happen only when we try to create embedded one-to-many or many-to-one objects in create API calls...
      const textValue = rawValue === undefined || rawValue === null ? "" : typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
      form.append(item.name, textValue);
      logItems.push({
        name: item.name,
        type: "text",
        value: textValue,
      });
    }
  }

  return { form, logItems };
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

    const rawFormData = input.formData ?? input.body;
    const formItems = Array.isArray(rawFormData) ? rawFormData : isPlainObject(rawFormData) ? formItemsFromRecord(rawFormData) : undefined;

    if (rawFormData !== undefined && !formItems) {
      throw new Error('formData/body must be an array of items or an object, for op "api.request".');
    }

    if (formItems && (input.json !== undefined || input.bodyText !== undefined)) {
      throw new Error('Use either formData/body or json/bodyText, not both, for op "api.request".');
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

    let formData: FormData | undefined;
    let formLogItems: Record<string, any>[] | undefined;
    if (formItems) {
      const built = await buildFormData(formItems);
      formData = built.form;
      formLogItems = built.logItems;
    }

    const req: ApiRequestOptions = {
      method: input.method,
      url: finalUrl,
      headers: input.headers,
      json: input.json,
      bodyText: input.bodyText,
      formData,
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
      formData: formLogItems,
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
