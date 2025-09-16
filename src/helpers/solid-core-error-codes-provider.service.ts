// src/common/errors/providers/solidcore-error-code.provider.ts
import { Injectable } from '@nestjs/common';
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
                code: 'solidx-mcp-server-unavailable',
                priority: 100, // run early
                match: (txt) =>
                    txt.includes('all connection attempts failed') &&
                    txt.includes('unhandled errors in a taskgroup (1 sub-exception)'),
                meta: {
                    message: 'SolidX MCP server is unreachable. Please verify the MCP endpoint.',
                    httpStatus: 503,
                },
            },
            {
                code: 'db-duplicate-key',
                priority: 90,
                match: (txt) => txt.includes('unique constraint') || txt.includes('duplicate key'),
                meta: {
                    message: 'Duplicate key violation. A record with these values already exists.',
                    httpStatus: 409,
                },
            },
            {
                code: 'db-foreign-key-error',
                priority: 90,
                match: (txt) => txt.includes('violates foreign key'),
                meta: {
                    message:
                        'Foreign key constraint prevents this operation due to related records.',
                    httpStatus: 409,
                },
            },
            {
                code: 'unknown-error',
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