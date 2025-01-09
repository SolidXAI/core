import { DiscoveryService } from "@nestjs/core";
import { isEmpty, isInt, isNotEmpty, isString } from "class-validator";
import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import {
  FieldCrudManager,
  ISelectionProvider,
  ISelectionProviderContext,
  ValidationError
} from "src/interfaces";

export interface SelectionDynamicFieldOptions {
    selectionDynamicProvider: string;
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
    selectionDynamicProviderCtxt: any;
}

export class SelectionDynamicFieldCrudManager implements FieldCrudManager {
    private options: SelectionDynamicFieldOptions;

    constructor(readonly fieldMetadata: FieldMetadata, readonly discoveryService: DiscoveryService) {
        this.options = { selectionDynamicProvider: fieldMetadata.selectionDynamicProvider, selectionDynamicProviderCtxt: fieldMetadata.selectionDynamicProviderCtxt, selectionValueType: fieldMetadata.selectionValueType as SelectionValueType, required: fieldMetadata.required };
    }

    async validate(dto: any): Promise<ValidationError[]> {
        const fieldValue: any = dto[this.fieldMetadata.name];
        return this.applyValidations(fieldValue);
    }

    private async applyValidations(fieldValue: any): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.fieldMetadata.name, error: `Field: ${this.fieldMetadata.name} is required` }) : "no errors";
        if (isNotEmpty(fieldValue)) {
            const formatErrors = await this.applyFormatValidations(fieldValue);
            errors.push(...formatErrors);
        }
        return errors;
    }

    private async applyFormatValidations(fieldValue: any): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        !this.isValidSelectionValueType(fieldValue, this.options.selectionValueType) ? errors.push({ field: this.fieldMetadata.name, error: 'Field value type is invalid' }) : "no errors";
        const _isValidSelectionValue = await this.isValidSelectionValue(fieldValue, this.options.selectionDynamicProvider)
        !_isValidSelectionValue ? errors.push({ field: this.fieldMetadata.name, error: 'Field value is invalid' }) : "no errors";
        return errors;
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
    private isValidSelectionValueType(fieldValue: any, selectionValueType: SelectionValueType): boolean {
        switch (selectionValueType) {
            case SelectionValueType.string:
                return isString(fieldValue);
            case SelectionValueType.int:
                return isInt(fieldValue);
            default:
                throw new Error(`Validation for selection value type ${selectionValueType} is not implemented`);
        }
    }

    private async isValidSelectionValue(fieldValue: any, selectionDynamicProvider: string): Promise<boolean> {
        const providerInstance = this.providerInstance<any>(selectionDynamicProvider);
        const values = await providerInstance.values('', this.options.selectionDynamicProviderCtxt);
        // return values.map(v => v.split(":")[0]).includes(fieldValue);
        return values.map(v => v.value).includes(fieldValue);
    }

    private providerInstance<T extends ISelectionProviderContext>(selectionDynamicProvider: string): ISelectionProvider<T> {
        const provider = this.discoveryService
            .getProviders()
            .filter((provider) => provider.name === selectionDynamicProvider)
            .pop();
        if (!provider) {
            throw new Error(`Provider for ${selectionDynamicProvider} not found`);
        }
        return provider.instance as ISelectionProvider<T>;
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}