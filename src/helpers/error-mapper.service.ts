// src/common/errors/error-mapper.service.ts
import { Injectable } from '@nestjs/common';

export const ERROR_CODES = [
    'bedrock-throttling-error',
    'bedrock-access-denied',
    'bedrock-input-too-long',
    'bedrock-validation-error',
    'bedrock-model-not-found',
    'db-duplicate-key',
    'db-foreign-key-error',
    'metadata-extraction-date-parsing-failed',
    'metadata-extraction-missing-s3-file',
    'solidx-mcp-server-unavailable',
    'unknown-error',
] as const;

export type ErrorCode = typeof ERROR_CODES[number];

// You can add more metadata here (e.g., severity, retryable, docs URL)
type ErrorDefinition = {
    template: string;
    httpStatus?: number;
    defaultVars?: Record<string, string | number | boolean>;
};

// Central place to define human-readable, templated messages
const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
    'bedrock-throttling-error': {
        template: 'Bedrock is rate-limiting requests{{#retryAfter}}. Try again in ~{{retryAfter}}s{{/retryAfter}}.',
        httpStatus: 429,
    },
    'bedrock-access-denied': {
        template: 'Access to Bedrock was denied. Check IAM roles/permissions for {{principal}}.',
        httpStatus: 403,
    },
    'bedrock-input-too-long': {
        template: 'Your input exceeded the model limit ({{limit}} tokens). Consider chunking or summarizing input.',
        httpStatus: 400,
    },
    'bedrock-validation-error': {
        template: 'The request to Bedrock failed validation. Field: {{field}}. Reason: {{reason}}.',
        httpStatus: 400,
    },
    'bedrock-model-not-found': {
        template: 'The requested model "{{modelId}}" is not available/enabled in region {{region}}.',
        httpStatus: 404,
    },
    'db-duplicate-key': {
        template: 'Duplicate key violation on {{constraint}}. A record with these unique fields already exists.',
        httpStatus: 409,
    },
    'db-foreign-key-error': {
        template: 'Foreign key constraint prevents this operation. Related records exist (constraint {{constraint}}).',
        httpStatus: 409,
    },
    'metadata-extraction-date-parsing-failed': {
        template: 'Failed to parse date fields during metadata extraction for document {{documentId}}.',
        httpStatus: 422,
    },
    'metadata-extraction-missing-s3-file': {
        template: 'Referenced S3 object was not found: s3://{{bucket}}/{{key}} (NoSuchKey).',
        httpStatus: 404,
    },
    'solidx-mcp-server-unavailable': {
        template: 'SolidX MCP server is unreachable. Last error: {{lastError}}. Please verify the MCP endpoint.',
        httpStatus: 503,
    },
    'unknown-error': {
        template: 'An unexpected error occurred. Reference: {{ref}}.',
        httpStatus: 500,
    },
};

@Injectable()
export class ErrorMapperService {
    /**
     * Given an error/exception, return a mapped error code string.
     * Default: "unknown-error"
     */
    mapException(exc: unknown): ErrorCode {
        const combined = this.combineErrorText(exc);

        if (
            combined.includes('all connection attempts failed') &&
            combined.includes('unhandled errors in a taskgroup (1 sub-exception)')
        ) {
            return 'solidx-mcp-server-unavailable';
        }

        // --- Bedrock errors ---
        if (
            combined.includes('throttlingexception') ||
            combined.includes('too many tokens')
        ) {
            return 'bedrock-throttling-error';
        }

        if (combined.includes('accessdeniedexception')) {
            return 'bedrock-access-denied';
        }

        if (
            combined.includes('validationexception') &&
            combined.includes('input is too long')
        ) {
            return 'bedrock-input-too-long';
        }

        if (combined.includes('validationexception')) {
            return 'bedrock-validation-error';
        }

        if (combined.includes('modelnotfoundexception')) {
            return 'bedrock-model-not-found';
        }

        // --- DB errors ---
        if (
            combined.includes('unique constraint') ||
            combined.includes('duplicate key')
        ) {
            return 'db-duplicate-key';
        }

        if (combined.includes('violates foreign key')) {
            return 'db-foreign-key-error';
        }

        // --- OpenSearch/meta extraction ---
        if (
            combined.includes('mapper_parsing_exception') &&
            (combined.includes('failed to parse field [metadata.properties.dates]') ||
                combined.includes('failed to parse field [metadata.properties.date_authored]'))
        ) {
            return 'metadata-extraction-date-parsing-failed';
        }

        // --- S3 ---
        if (combined.includes('nosuchkey') && combined.includes('getobject')) {
            return 'metadata-extraction-missing-s3-file';
        }

        return 'unknown-error';
    }

    /**
     * Same mapping, but takes raw strings instead of an Exception object.
     */
    mapMessage(message: string, trace?: string): ErrorCode {
        const combined = `${message ?? ''}\n${trace ?? ''}`.toLowerCase();
        return this.mapException(combined);
    }

    /**
     * Render a human-readable error message for a given code.
     * Pass variables to fill {{placeholders}} in the template.
     */
    renderMessage(code: ErrorCode, vars?: Record<string, unknown>): string {
        const def = ERROR_DEFINITIONS[code] ?? ERROR_DEFINITIONS['unknown-error'];
        const merged = { ...(def.defaultVars ?? {}), ...(vars ?? {}) };
        return renderTemplate(def.template, merged);
    }

    // /**
    //  * Helpful wrapper to produce a consistent error payload (RFC7807-ish).
    //  */
    // toProblem(code: ErrorCode, vars?: Record<string, unknown>, extra?: Record<string, unknown>,) {
    //     const def = ERROR_DEFINITIONS[code] ?? ERROR_DEFINITIONS['unknown-error'];
    //     return {
    //         type: `about:blank#${code}`,
    //         title: code,
    //         status: def.httpStatus ?? 500,
    //         detail: this.renderMessage(code, vars),
    //         ...(extra ?? {}),
    //     };
    // }

    // ---- helpers ----
    private combineErrorText(exc: unknown): string {
        if (typeof exc === 'string') {
            return exc.toLowerCase();
        }

        if (exc instanceof Error) {
            const message = exc.message ?? '';
            const stack = exc.stack ?? '';
            return `${message}\n${stack}`.toLowerCase();
        }

        if (exc && typeof exc === 'object') {
            try {
                const maybeAny = exc as Record<string, unknown>;
                const msg =
                    String(maybeAny.message ?? '') ||
                    String((maybeAny as any)['Message'] ?? '') ||
                    '';
                const name =
                    String(maybeAny.name ?? '') ||
                    String((maybeAny as any)['__type'] ?? '') ||
                    '';
                const stack = String((maybeAny as any).stack ?? '');
                const json = safeJsonStringify(maybeAny);
                return `${name}\n${msg}\n${stack}\n${json}`.toLowerCase();
            } catch {
                // ignore
            }
        }

        return String(exc ?? '').toLowerCase();
    }
}

// ---- tiny template engine: supports {{var}} and {{#var}}...{{/var}} sections ----
function renderTemplate(template: string, vars: Record<string, unknown>): string {
    // Section syntax: {{#name}}...{{/name}} is included only if vars[name] is truthy
    template = template.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (_, key: string, content: string) => {
        const v = vars[key];
        return v ? String(content) : '';
    });

    // Simple variable replacement: {{name}}
    return template.replace(/{{(\w+)}}/g, (_, key: string) => {
        const v = vars[key];
        return v === undefined || v === null ? '' : String(v);
    });
}

function safeJsonStringify(obj: unknown): string {
    try {
        return JSON.stringify(obj);
    } catch {
        return '';
    }
}