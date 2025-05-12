import { DiscoveryService } from "@nestjs/core";
import { isEmpty, isInt, isNotEmpty, isString } from "class-validator";
import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, ISelectionProvider, ISelectionProviderContext, ValidationError } from "src/interfaces";

export interface SelectionDynamicFieldOptions {
    selectionDynamicProvider: string;
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
    selectionDynamicProviderCtxt: any;
    fieldName: string;
    discoveryService: DiscoveryService;
}

export class SelectionDynamicFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: SelectionDynamicFieldOptions) {
    }

    async validate(dto: any): Promise<ValidationError[]> {
        const fieldValue: any = dto[this.options.fieldName];
        return this.applyValidations(fieldValue);
    }

    private async applyValidations(fieldValue: any): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required` }) : "no errors";
        if (isNotEmpty(fieldValue)) {
            const formatErrors = await this.applyFormatValidations(fieldValue);
            errors.push(...formatErrors);
        }
        return errors;
    }

    private async applyFormatValidations(fieldValue: any): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        !this.isValidSelectionValueType(fieldValue, this.options.selectionValueType) ? errors.push({ field: this.options.fieldName, error: 'Field value type is invalid' }) : "no errors";
        const _isValidSelectionValue = await this.isValidSelectionValue(fieldValue, this.options.selectionDynamicProvider)
        !_isValidSelectionValue ? errors.push({ field: this.options.fieldName, error: 'Field value is invalid' }) : "no errors";
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
        const values = await providerInstance.values('', JSON.parse(this.options.selectionDynamicProviderCtxt));
        // return values.map(v => v.split(":")[0]).includes(fieldValue);
        return values.map(v => v.value).includes(fieldValue);
    }

    private providerInstance<T extends ISelectionProviderContext>(selectionDynamicProvider: string): ISelectionProvider<T> {
        const provider = this.options.discoveryService
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