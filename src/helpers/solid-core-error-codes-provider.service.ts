// src/common/errors/providers/solidcore-error-code.provider.ts
import { Injectable } from '@nestjs/common';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { ErrorCodeProvider } from 'src/decorators/error-codes-provider.decorator';
import { ErrorMeta, ErrorRule, IErrorCodeProvider } from 'src/interfaces';


@ErrorCodeProvider()
@Injectable()
export class SolidCoreErrorCodesProvider implements IErrorCodeProvider {
    name(): string {
        return 'SolidCoreErrorCodeProvider';
    }

    rules(): ReadonlyArray<ErrorRule> {
        return [
            {
                code: 'solidx-session-invalid',
                priority: 110,
                match: (txt) => txt.includes(ERROR_MESSAGES.SESSION_INVALID.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.SESSION_INVALID,
                    httpStatus: 401,
                },
            },
            {
                code: 'solidx-session-expired',
                priority: 110,
                match: (txt) => txt.includes(ERROR_MESSAGES.SESSION_EXPIRED.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.SESSION_EXPIRED,
                    httpStatus: 401,
                },
            },
            // MPIN rules sit above the generic session rules so that an MPIN
            // failure is never reported as a session problem. The three codes
            // drive three different client behaviours: retry, wait, and
            // discard-the-handle.
            {
                code: 'solidx-mpin-locked',
                priority: 120,
                match: (txt) => txt.includes(ERROR_MESSAGES.MPIN_LOCKED.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.MPIN_LOCKED,
                    httpStatus: 401,
                },
            },
            {
                code: 'solidx-mpin-revoked',
                priority: 120,
                match: (txt) => txt.includes(ERROR_MESSAGES.MPIN_REVOKED.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.MPIN_REVOKED,
                    httpStatus: 401,
                },
            },
            {
                code: 'solidx-mpin-invalid',
                priority: 120,
                match: (txt) => txt.includes(ERROR_MESSAGES.MPIN_INVALID.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.MPIN_INVALID,
                    httpStatus: 401,
                },
            },
            // Setup-time rejections. Distinct codes so the client can say
            // "choose a less predictable PIN" rather than parsing a message.
            // Safe to distinguish: both occur only on bearer-authenticated
            // routes, so neither discloses anything.
            {
                code: 'solidx-mpin-too-predictable',
                priority: 120,
                match: (txt) => txt.includes(ERROR_MESSAGES.MPIN_TOO_PREDICTABLE.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.MPIN_TOO_PREDICTABLE,
                    httpStatus: 400,
                },
            },
            {
                code: 'solidx-mpin-format-invalid',
                priority: 120,
                match: (txt) => txt.includes(ERROR_MESSAGES.MPIN_FORMAT_INVALID.toLowerCase()),
                meta: {
                    message: ERROR_MESSAGES.MPIN_FORMAT_INVALID,
                    httpStatus: 400,
                },
            },
            {
                code: 'solidx-mcp-server-unavailable',
                priority: 100,
                match: (txt) =>
                    txt.includes('all connection attempts failed') &&
                    txt.includes('unhandled errors in a taskgroup (1 sub-exception)'),
                meta: {
                    message: 'SolidX MCP server is unreachable. Please verify the MCP endpoint.',
                    httpStatus: 503,
                },
            },
            {
                code: 'solidx-resource-not-found',
                priority: 95,
                match: (txt) => txt.includes('enoent') && txt.includes('no such file or directory'),
                meta: {
                    message: ERROR_MESSAGES.RESOURCE_NOT_FOUND,
                    httpStatus: 404,
                },
            },
            {
                code: 'solidx-db-duplicate-key',
                priority: 90,
                match: (txt) => txt.includes('unique constraint') || txt.includes('duplicate key'),
                meta: {
                    message: 'Duplicate key violation. A record with these values already exists.',
                    httpStatus: 409,
                },
            },
            {
                code: 'solidx-db-foreign-key-error',
                priority: 90,
                match: (txt) => txt.includes('violates foreign key'),
                meta: {
                    message:
                        'Foreign key constraint prevents this operation due to related records.',
                    httpStatus: 409,
                },
            },
            {
                code: 'solidx-unknown-error',
                priority: -1, // last resort
                match: (_txt) => true, // fallback catch-all
                meta: {
                    message: 'An unexpected error occurred.',
                    httpStatus: 500,
                },
            },
        ];
    }

    // Optional explicit meta resolution (if you want)
    resolve(code: string): ErrorMeta | undefined {
        const rule = this.rules().find((r) => r.code === code);
        return rule?.meta;
    }
}
