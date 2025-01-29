import { isEmpty, isNotEmpty, isString, matches, max, min } from "class-validator";
import { FieldCrudManager, ValidationError } from "src/interfaces";
import { BcryptService } from "src/services/bcrypt.service";
import { HashingService } from "src/services/hashing.service";

export interface PasswordFieldOptions {
    min: number | undefined | null;
    max: number | undefined | null;
    required: boolean | undefined | null;
    regexPattern: string | undefined | null;
    fieldName: string | undefined | null;
}

export class PasswordFieldCrudManager implements FieldCrudManager {
    private hashingService: HashingService = new BcryptService(); //FIXME: The bcrypt service injected here probably can be optimized to be a singleton

    constructor(private readonly options: PasswordFieldOptions) {
    }

    validate(dto: any): ValidationError[] {
        const fieldValue: any = dto[this.options.fieldName];
        return this.applyValidations(fieldValue, dto);
    }

    private applyValidations(fieldValue: any, dto: any): ValidationError[] {
        const errors: ValidationError[] = [];
        this.isApplyRequiredValidation() && isEmpty(fieldValue) ? errors.push({ field: this.options.fieldName, error: `Field: ${this.options.fieldName} is required` }): "no errors";
        if (isNotEmpty(fieldValue)) {
            errors.push(...this.applyFormatValidations(fieldValue, dto));
        }
        return errors;
    }

    private applyFormatValidations(fieldValue: any, dto:any): ValidationError[] {
        const errors: ValidationError[] = [];
        !isString(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Field is not a string' }) : "no errors";
        !this.isPasswordValid(fieldValue) ? errors.push({ field: this.options.fieldName, error: 'Password regex pattern is invalid' }) : "no errors";
        this.isApplyMinValidation() && !min(fieldValue, this.options.min) ? errors.push({ field: this.options.fieldName, error: 'Field value is lesser than minimum required' }) : "no errors";
        this.isApplyMaxValidation() && !max(fieldValue, this.options.max) ? errors.push({ field: this.options.fieldName, error: 'Field value is greater than maximum required' }) : "no errors";
        !this.isConfirmPasswordValid(dto) ? errors.push({ field: this.options.fieldName, error: 'Password and confirm password do not match' }) : "no errors";
        return errors;
    }

    async transformForCreate(dto: any): Promise<any> {
        if(dto[this.options.fieldName]){
            dto[this.options.fieldName] = await this.hashingService.hash(dto[this.options.fieldName]);
        }
        return dto;
    }

    // Validation to be applied
    private isApplyMinValidation(): boolean {
        return this.options.min > 0;
    }
    private isApplyMaxValidation(): boolean {
        return this.options.max > 0;
    }
    private isPasswordValid(password: string): boolean {
        return matches(password, new RegExp(this.options.regexPattern ?? String.raw`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).*$`)); 
    }
    private isConfirmPasswordValid(dto: any): boolean {
        const passwordFieldName = this.options.fieldName;
        const confirmPasswordFieldName = `${passwordFieldName}Confirm`;
        return dto[passwordFieldName] === dto[confirmPasswordFieldName];
    }

    private isApplyRequiredValidation(): boolean {
        return this.options.required;
    }
}