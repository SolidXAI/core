import { Injectable, Logger } from '@nestjs/common';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ErrorCode, ErrorMeta, ErrorRule, IErrorCodeProvider } from 'src/interfaces';
@Injectable()
export class ErrorMapperService {
    private readonly logger = new Logger(ErrorMapperService.name);

    constructor(private readonly solidRegistry: SolidRegistry) { }

    /** Map an exception object (or string) to a canonical ErrorCode */
    mapException(exc: unknown): ErrorCode {
        const combined = this.combineErrorText(exc);
        return this.matchCode(combined);
    }

    /** Map plain message/trace to ErrorCode */
    mapMessage(message: string, trace?: string): ErrorCode {
        const combined = `${message ?? ''}\n${trace ?? ''}`.toLowerCase();
        return this.matchCode(combined);
    }

    /** Get static message for a given code */
    getMessage(code: ErrorCode): string {
        const meta = this.lookupMeta(code);
        return (meta ?? { message: 'An unexpected error occurred.' }).message;
    }

    /** Get default HTTP status for a code (falls back to 500) */
    getHttpStatus(code: ErrorCode): number {
        const meta = this.lookupMeta(code);
        return meta?.httpStatus ?? 500;
    }

    // ---- internal helpers ----
    private matchCode(combined: string): ErrorCode {
        const rules = this.getAllRulesSorted();
        for (const rule of rules) {
            try {
                if (rule.match(combined)) return rule.code;
            } catch (e) {
                // Defensive: bad provider shouldn't crash mapping
                this.logger.warn(`Error rule threw in match(): code=${rule.code} provider? — ${e}`);
            }
        }
        return 'solidx-unknown-error';
    }

    private lookupMeta(code: ErrorCode): ErrorMeta | undefined {
        // Prefer the first rule with that code
        const rules = this.getAllRulesSorted();
        const rule = rules.find((r) => r.code === code);
        if (rule?.meta) return rule.meta;

        // Optional: ask providers directly if they implement resolve()
        const providers = this.getProviders();
        for (const p of providers) {
            if (p.resolve) {
                const meta = p.resolve(code);
                if (meta) return meta;
            }
        }
        return undefined;
    }

    private getAllRulesSorted(): ReadonlyArray<ErrorRule> {
        const providers = this.getProviders();
        const all: ErrorRule[] = [];
        for (const p of providers) {
            try {
                const rules = p.rules() ?? [];
                // Optional: namespace collision check can be added here if desired
                all.push(...rules);
            } catch (e) {
                this.logger.warn(`ErrorCodeProvider.rules() failed for ${p.name?.()}: ${e}`);
            }
        }
        // Sort by priority desc; default 0
        return all.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    private getProviders(): IErrorCodeProvider[] {
        // convert InstanceWrapper → instance
        return this.solidRegistry
            .getErrorCodeProviders()
            .map((w) => w.instance)
            .filter(Boolean) as IErrorCodeProvider[];
    }

    private combineErrorText(exc: unknown): string {
        if (typeof exc === 'string') return exc.toLowerCase();

        if (exc instanceof Error) {
            const message = exc.message ?? '';
            const stack = exc.stack ?? '';
            return `${message}\n${stack}`.toLowerCase();
        }

        if (exc && typeof exc === 'object') {
            try {
                const obj = exc as Record<string, unknown>;
                const msg = String(obj.message ?? (obj as any)['Message'] ?? '');
                const name = String(obj.name ?? (obj as any)['__type'] ?? '');
                const stack = String((obj as any).stack ?? '');
                const json = this.safeJsonStringify(obj);
                return `${name}\n${msg}\n${stack}\n${json}`.toLowerCase();
            } catch {
                // ignore
            }
        }

        return String(exc ?? '').toLowerCase();
    }

    private safeJsonStringify(obj: unknown): string {
        try {
            return JSON.stringify(obj);
        } catch {
            return '';
        }
    }
}