"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputedFieldCrudManager = void 0;
class ComputedFieldCrudManager {
    constructor(fieldMetadata, discoveryService) {
        this.fieldMetadata = fieldMetadata;
        this.discoveryService = discoveryService;
        this.options = { computedFieldProvider: fieldMetadata.computedFieldValueProvider, computedFieldValueProviderCtxt: fieldMetadata.computedFieldValueProviderCtxt, computedFieldValueType: fieldMetadata.computedFieldValueType };
    }
    async validate() {
        return [];
    }
    async transformForCreate(dto) {
        const ctxt = this.options.computedFieldValueProviderCtxt ? JSON.parse(this.options.computedFieldValueProviderCtxt) : {};
        dto[this.fieldMetadata.name] = await this.computeValue(dto, ctxt);
        return dto;
    }
    async computeValue(dto, ctxt) {
        const provider = this.providerInstance(this.options.computedFieldProvider);
        return provider.computeValue(dto, ctxt);
    }
    providerInstance(computedFieldProvider) {
        const provider = this.discoveryService
            .getProviders()
            .filter((provider) => provider.name === computedFieldProvider)
            .pop();
        if (!provider) {
            throw new Error(`Provider for ${computedFieldProvider} not found`);
        }
        return provider.instance;
    }
}
exports.ComputedFieldCrudManager = ComputedFieldCrudManager;
//# sourceMappingURL=ComputedFieldCrudManager.js.map