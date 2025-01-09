import { DiscoveryService } from "@nestjs/core";
import { ComputedFieldValueType } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface ComputedFieldOptions {
    computedFieldProvider: string;
    computedFieldValueType: ComputedFieldValueType;
    computedFieldValueProviderCtxt: any;
}
export declare class ComputedFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    readonly discoveryService: DiscoveryService;
    private options;
    constructor(fieldMetadata: FieldMetadata, discoveryService: DiscoveryService);
    validate(): Promise<ValidationError[]>;
    transformForCreate(dto: any): Promise<any>;
    private computeValue;
    private providerInstance;
}
