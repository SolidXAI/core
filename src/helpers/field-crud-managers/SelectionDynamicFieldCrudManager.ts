import { DiscoveryService } from "@nestjs/core";
import { isEmpty, isInt, isNotEmpty, isString } from "class-validator";
import { SelectionValueType } from "src/dtos/create-field-metadata.dto";
import { FieldCrudManager, ISelectionProvider, ISelectionProviderContext, ValidationError } from "src/interfaces";

export interface SelectionDynamicFieldOptions {
    selectionDynamicProvider: string;
    selectionValueType: SelectionValueType;
    required: boolean | undefined | null;
    selectionDynamicProviderCtxt: ISelectionProviderContext;
    fieldName: string;
    discoveryService: DiscoveryService;
    isMultiSelect: boolean | undefined | null;
}

export class SelectionDynamicFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: SelectionDynamicFieldOptions) {
    }

    async validate(dto: any): Promise<ValidationError[]> {
        const fieldValue: any = dto[this.options.fieldName];
        // return this.applyValidations(fieldValue);
        const isMultiSelect = this.options?.isMultiSelect;
        if (isMultiSelect && fieldValue) {
            const arrayCheck = this.parseAndValidateArray(fieldValue);

            if (!arrayCheck.isValid) {
                return [
                    {
                        field: this.options.fieldName,
                        error: `Field: ${this.options.fieldName} must be a valid array`,
                    },
                ];
            }

            const values = arrayCheck.values;

            if (this.isApplyRequiredValidation() && values.length === 0) {
                return [
                    {
                        field: this.options.fieldName,
                        error: `Field: ${this.options.fieldName} is required`,
                    },
                ];
            }

            // Apply validations to each value
            const allErrors = await Promise.all(values.map((val) => this.applyValidations(val)));
            return allErrors.flat();
        } else {
            // For non-multi-select, apply validations to the single field value
            return this.applyValidations(fieldValue);
        }
    }

    private parseAndValidateArray(fieldValue: any): { isValid: boolean; values: any[] } {
        if (Array.isArray(fieldValue)) {
            return { isValid: true, values: fieldValue };
        }

        try {
            const parsed = typeof fieldValue === 'string' ? JSON.parse(fieldValue) : null;
            if (Array.isArray(parsed)) {
                return { isValid: true, values: parsed };
            }
        } catch {
            // fall through
        }

        return { isValid: false, values: [] };
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
        const ctxt = this.options.selectionDynamicProviderCtxt;
        if (ctxt.validateOnSave !== false) {
            const _isValidSelectionValue = await this.isValidSelectionValue(fieldValue, this.options.selectionDynamicProvider, ctxt);
            !_isValidSelectionValue ? errors.push({ field: this.options.fieldName, error: 'Field value is invalid' }) : "no errors";
        }
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

    private async isValidSelectionValue(fieldValue: any, selectionDynamicProvider: string, ctxt: ISelectionProviderContext): Promise<boolean> {
        const providerInstance = this.providerInstance<any>(selectionDynamicProvider);
        try {
            // Use the value method first
            const valueOption = await providerInstance.value(fieldValue, ctxt);
            if (valueOption && valueOption.value === fieldValue) {
                return true;
            }
            return false;
        }
        catch (error) {
            // Use the values method as a fallback, if the value method is not implemented
            const values = await providerInstance.values('', ctxt);
            const isValid = values.some(v => v.value === fieldValue);
            return isValid;
        }
    }

    private providerInstance<T extends ISelectionProviderContext>(selectionDynamicProvider: string): ISelectionProvider<T> {
        const providers = this.options.discoveryService.getProviders();

        const byToken = providers.find((p) => p.name === selectionDynamicProvider);
        if (byToken) {
            return byToken.instance as ISelectionProvider<T>;
        }

        const byName = providers.find((p) => {
            try {
                return typeof p.instance?.name === 'function' && p.instance.name() === selectionDynamicProvider;
            } catch {
                return false;
            }
        });

        if (!byName) {
            throw new Error(`Provider for ${selectionDynamicProvider} not found`);
        }
        return byName.instance as ISelectionProvider<T>;
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}