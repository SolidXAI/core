import { ComputedFieldMetadata } from "src/helpers/solid-registry";
import { IEntityPostComputeFieldProvider, IEntityPreComputeFieldProvider } from "src/interfaces";

export class NoopsEntityComputedFieldProviderService implements IEntityPreComputeFieldProvider<any, any> , IEntityPostComputeFieldProvider<any, any>  {
    constructor() {}

    name(): string {
        return "NoopsEntityComputedFieldProviderService";
    }

    help(): string {
        return "This is a no-op computed field provider that does nothing.";
    }

    async preComputeValue(entity: any, computedFieldMetadata: ComputedFieldMetadata<any>): Promise<void> {
        // No operation performed
    }

    async postComputeAndSaveValue(entity: any, computedFieldMetadata: ComputedFieldMetadata<any>): Promise<void> {
        // No operation performed
    }
}