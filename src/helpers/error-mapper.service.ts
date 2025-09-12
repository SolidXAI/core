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

@Injectable()
export class ErrorMapperService {
    /**
     * Given an error/exception, return a mapped error code string.
     * Default: "unknown-error"
     */
    mapException(exc: unknown): ErrorCode {
        const combined = this.combineErrorText(exc);

        // AiInteraction - mcp server down. 
        // {
        //     "success": false,
        //     "errors": [
        //         "unhandled errors in a TaskGroup (1 sub-exception)"
        //     ],
        //     "error_trace": [
        //         "Traceback (most recent call last):",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/mcp/client/sse.py\", line 47, in sse_client\n    async with aconnect_sse(\n               ^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 210, in __aenter__\n    return await anext(self.gen)\n           ^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx_sse/_api.py\", line 69, in aconnect_sse\n    async with client.stream(method, url, headers=headers, **kwargs) as response:\n               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 210, in __aenter__\n    return await anext(self.gen)\n           ^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1583, in stream\n    response = await self.send(\n               ^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1629, in send\n    response = await self._send_handling_auth(\n               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1657, in _send_handling_auth\n    response = await self._send_handling_redirects(\n               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1694, in _send_handling_redirects\n    response = await self._send_single_request(request)\n               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1730, in _send_single_request\n    response = await transport.handle_async_request(request)\n               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_transports/default.py\", line 393, in handle_async_request\n    with map_httpcore_exceptions():\n         ^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 158, in __exit__\n    self.gen.throw(value)",
        //         "File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_transports/default.py\", line 118, in map_httpcore_exceptions\n    raise mapped_exc(message) from exc",
        //         "httpx.ConnectError: All connection attempts failed",
        //         "During handling of the above exception, another exception occurred:",
        //         "+ Exception Group Traceback (most recent call last):",
        //         "|   File \"/Users/harishpatel/mcp/clients/solidx_mcp_client/client_sse_nochat.py\", line 239, in main\n  |     await client.connect_to_sse_server()",
        //         "|   File \"/Users/harishpatel/mcp/clients/solidx_mcp_client/client_sse_nochat.py\", line 49, in connect_to_sse_server\n  |     streams = await self._streams_context.__aenter__()\n  |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 210, in __aenter__\n  |     return await anext(self.gen)\n  |            ^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/mcp/client/sse.py\", line 43, in sse_client\n  |     async with anyio.create_task_group() as tg:\n  |                ^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/anyio/_backends/_asyncio.py\", line 767, in __aexit__\n  |     raise BaseExceptionGroup(",
        //         "| ExceptionGroup: unhandled errors in a TaskGroup (1 sub-exception)",
        //         "+-+---------------- 1 ----------------",
        //         "| Traceback (most recent call last):",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_transports/default.py\", line 101, in map_httpcore_exceptions\n    |     yield",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_transports/default.py\", line 394, in handle_async_request\n    |     resp = await self._pool.handle_async_request(req)\n    |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_async/connection_pool.py\", line 256, in handle_async_request\n    |     raise exc from None",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_async/connection_pool.py\", line 236, in handle_async_request\n    |     response = await connection.handle_async_request(\n    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_async/connection.py\", line 101, in handle_async_request\n    |     raise exc",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_async/connection.py\", line 78, in handle_async_request\n    |     stream = await self._connect(request)\n    |              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_async/connection.py\", line 124, in _connect\n    |     stream = await self._network_backend.connect_tcp(**kwargs)\n    |              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_backends/auto.py\", line 31, in connect_tcp\n    |     return await self._backend.connect_tcp(\n    |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_backends/anyio.py\", line 113, in connect_tcp\n    |     with map_exceptions(exc_map):\n    |          ^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 158, in __exit__\n    |     self.gen.throw(value)",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpcore/_exceptions.py\", line 14, in map_exceptions\n    |     raise to_exc(exc) from exc",
        //         "| httpcore.ConnectError: All connection attempts failed",
        //         "| \n    | The above exception was the direct cause of the following exception:\n    |",
        //         "| Traceback (most recent call last):",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/mcp/client/sse.py\", line 47, in sse_client\n    |     async with aconnect_sse(\n    |                ^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 210, in __aenter__\n    |     return await anext(self.gen)\n    |            ^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx_sse/_api.py\", line 69, in aconnect_sse\n    |     async with client.stream(method, url, headers=headers, **kwargs) as response:\n    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 210, in __aenter__\n    |     return await anext(self.gen)\n    |            ^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1583, in stream\n    |     response = await self.send(\n    |                ^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1629, in send\n    |     response = await self._send_handling_auth(\n    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1657, in _send_handling_auth\n    |     response = await self._send_handling_redirects(\n    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1694, in _send_handling_redirects\n    |     response = await self._send_single_request(request)\n    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_client.py\", line 1730, in _send_single_request\n    |     response = await transport.handle_async_request(request)\n    |                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_transports/default.py\", line 393, in handle_async_request\n    |     with map_httpcore_exceptions():\n    |          ^^^^^^^^^^^^^^^^^^^^^^^^^",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/lib/python3.12/contextlib.py\", line 158, in __exit__\n    |     self.gen.throw(value)",
        //         "|   File \"/Users/harishpatel/.pyenv/versions/3.12.7/envs/solid_mcp_client/lib/python3.12/site-packages/httpx/_transports/default.py\", line 118, in map_httpcore_exceptions\n    |     raise mapped_exc(message) from exc",
        //         "| httpx.ConnectError: All connection attempts failed",
        //         "+------------------------------------"
        //     ],
        //     "request": "\"Can you do 1 + 1\""
        // }
        if (combined.includes("all connection attempts failed") && combined.includes("unhandled errors in a taskgroup (1 sub-exception)")) {
            return 'solidx-mcp-server-unavailable';
        }

        // --- Bedrock errors ---
        // Throttling: "ThrottlingException" or "Too many tokens"
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

        if (combined.includes('foreign key')) {
            return 'db-foreign-key-error';
        }

        // --- OpenSearch errors ---
        // mapper_parsing_exception on specific fields
        if (
            combined.includes('mapper_parsing_exception') &&
            (combined.includes('failed to parse field [metadata.properties.dates]') ||
                combined.includes(
                    'failed to parse field [metadata.properties.date_authored]',
                ))
        ) {
            return 'metadata-extraction-date-parsing-failed';
        }

        // --- S3 errors ---
        // NoSuchKey during GetObject
        if (combined.includes('nosuchkey') && combined.includes('getobject')) {
            return 'metadata-extraction-missing-s3-file';
        }

        // --- Catch-all ---
        return 'unknown-error';
    }

    /**
     * Same mapping, but takes raw strings instead of an Exception object.
     */
    mapMessage(message: string, trace?: string): ErrorCode {
        const combined = `${message ?? ''}\n${trace ?? ''}`.toLowerCase();
        return this.mapException(combined);
    }

    // ---- helpers ----

    private combineErrorText(exc: unknown): string {
        // If caller passed us a pre-lowered string (e.g. from mapMessage), use it
        if (typeof exc === 'string') {
            return exc.toLowerCase();
        }

        // Standard Error
        if (exc instanceof Error) {
            const message = exc.message ?? '';
            // Many libs set .stack to "Error: message\n<stack>"
            // We still include it in case upstream mutated it.
            const stack = exc.stack ?? '';
            return `${message}\n${stack}`.toLowerCase();
        }

        // Some SDKs throw objects (e.g., { name, message, code, $metadata, ... })
        if (exc && typeof exc === 'object') {
            try {
                const maybeAny = exc as Record<string, unknown>;
                const msg =
                    String(maybeAny.message ?? '') ||
                    String(maybeAny['Message'] ?? '') ||
                    '';
                const name =
                    String(maybeAny.name ?? '') ||
                    String(maybeAny['__type'] ?? '') ||
                    '';
                const stack = String((maybeAny as any).stack ?? '');
                // Also fold in a JSON snapshot as a last resort
                const json = safeJsonStringify(maybeAny);
                return `${name}\n${msg}\n${stack}\n${json}`.toLowerCase();
            } catch {
                // fall through
            }
        }

        // Fallback
        return String(exc ?? '').toLowerCase();
    }
}

function safeJsonStringify(obj: unknown): string {
    try {
        return JSON.stringify(obj);
    } catch {
        return '';
    }
}