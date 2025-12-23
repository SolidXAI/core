import { Injectable } from "@nestjs/common";
import canonicalize from 'canonicalize';
import { createHash } from "crypto";

export interface HashComputationOptions {
    /**
     * Explicit override for normalization.
     * Defaults are type-based.
     */
    normalization: 'raw' | 'canonical'; //TODO: identify the type of the field and set default normalization accordingly

    /**
     * Output encoding
     */
    encoding?: 'hex' | 'base64';

    /**
     * Optional salt (versioning / namespacing)
     */
    salt?: string;
}

@Injectable()
export class SHA256HashService {
    constructor() { }

    compute(
        value: unknown,
        options: HashComputationOptions,
    ): string {
        if (value === null || value === undefined) {
            return null
        }

        const {
            normalization,
            encoding = 'hex',
            salt = '',
        } = options;

        const material = this.normalize(value, normalization);

        return createHash('sha256')
            .update(salt)
            .update(material)
            .digest(encoding);
    }

    private normalize(
        value: unknown,
        normalization?: 'raw' | 'canonical',
    ): Buffer {
        // Binary inputs → raw bytes
        if (Buffer.isBuffer(value)) {
            return value;
        }

        if (value instanceof Uint8Array) {
            return Buffer.from(value);
        }

        // Strings → UTF-8 bytes
        if (typeof value === 'string') {
            return Buffer.from(value, 'utf8');
        }

        // Objects → canonical JSON (default)
        if (typeof value === 'object') {
            if (normalization === 'raw') {
                // Explicit opt-out of canonicalization
                return Buffer.from(JSON.stringify(value), 'utf8');
            }

            const canonical = canonicalize(value);

            if (!canonical) {
                throw new Error('Failed to canonicalize object for hashing');
            }

            return Buffer.from(canonical, 'utf8');
        }

        // Numbers / booleans / symbols → explicit string conversion
        return Buffer.from(String(value), 'utf8');
    }

}