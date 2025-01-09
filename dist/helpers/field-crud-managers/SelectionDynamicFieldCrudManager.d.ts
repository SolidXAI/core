import { DiscoveryService } from "@nestjs/core";
import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export interface SelectionDynamicFieldOptions {
    selectionDynamicProvider: string;
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
    selectionDynamicProviderCtxt: any;
}
export declare class SelectionDynamicFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    readonly discoveryService: DiscoveryService;
    private options;
    constructor(fieldMetadata: FieldMetadata, discoveryService: DiscoveryService);
    validate(dto: any): Promise<ValidationError[]>;
    private applyValidations;
    private applyFormatValidations;
    transformForCreate(dto: any): any;
    private isValidSelectionValueType;
    private isValidSelectionValue;
    private providerInstance;
    private isApplyRequiredValidation;
}
