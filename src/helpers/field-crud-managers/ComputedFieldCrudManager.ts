import { DiscoveryService } from "@nestjs/core";
import { ComputedFieldValueType } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, IComputedFieldProvider, ValidationError } from "src/interfaces";

export interface ComputedFieldOptions {
    computedFieldProvider: string;
    computedFieldValueType: ComputedFieldValueType;
    computedFieldValueProviderCtxt: any;
    fieldName: string;
    discoveryService: DiscoveryService;
    skipComputation: boolean;
}

export class ComputedFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: ComputedFieldOptions) {
    }

    async validate(): Promise<ValidationError[]> {
        return []; //Since this is a computed field, we can skip the validation, by returning an empty array
    }

    async transformForCreate(dto: any): Promise<any> {
        if (this.options.skipComputation) {
            return dto; // Skip computation if the flag is set
        }
        const ctxt = this.options.computedFieldValueProviderCtxt ? JSON.parse(this.options.computedFieldValueProviderCtxt) : {};
        dto[this.options.fieldName] = await this.computeValue(dto, ctxt);
        return dto;
    }

    private async computeValue(dto: any, ctxt: any): Promise<string|number> {
        const provider = this.providerInstance<any, any>(this.options.computedFieldProvider);
        return provider.computeValue(dto, ctxt);
    }

    private providerInstance<DTO, T>(computedFieldProvider: string): IComputedFieldProvider<T> {
        const provider = this.options.discoveryService
            .getProviders()
            .filter((provider) => provider.name === computedFieldProvider) //TODO : Add an extra check to verify if the provider is of type IComputedFieldProvider
            .pop();
        if (!provider) {
            throw new Error(`Provider for ${computedFieldProvider} not found`);
        }
        return provider.instance as IComputedFieldProvider<T>;
    }
}