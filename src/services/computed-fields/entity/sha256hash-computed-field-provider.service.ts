import { Injectable } from "@nestjs/common";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";
import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPreComputeFieldProvider } from "src/interfaces";
import { HashComputationOptions, SHA256HashService } from "src/services/sha-256-hash.service";


export interface SHA256HashComputedFieldContext extends HashComputationOptions {
    /**
     * Field to hash
     */
    field: string;
}
@ComputedFieldProvider()
@Injectable()
export class SHA256HashComputationProvider implements IEntityPreComputeFieldProvider<unknown, SHA256HashComputedFieldContext> {
    constructor(
        private readonly sha256HashService: SHA256HashService,
    ) { }

    name(): string {
        return "SHA256HashComputationProvider";
    }

    help(): string {
        return "This computed field provider calculates the SHA-256 hash of the entity. Supports normalization and encoding options.";
    }

    async preComputeValue(entity: any, computedFieldMetadata: ComputedFieldMetadata<SHA256HashComputedFieldContext>): Promise<void> {
        // No operation performed
        const { computedFieldValueProviderCtxt } = computedFieldMetadata;
        const fieldToHash = computedFieldValueProviderCtxt.field;
        const valueToHash = entity[fieldToHash];

        const hash = this.sha256HashService.compute(valueToHash, computedFieldValueProviderCtxt);

        // set the computed field on the entity
        entity[computedFieldMetadata.fieldName] = hash;
    }
}