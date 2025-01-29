import { FieldCrudManager, ValidationError } from "src/interfaces";

export enum SolidMediaType {
    mediaSingle = 'mediaSingle',
    mediaMultiple = 'mediaMultiple'
}

export interface MediaFieldOptions {
    type: SolidMediaType;
    required: boolean | undefined | null;
    fieldName: string | undefined | null;
}

export class MediaFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: MediaFieldOptions) {
    }

    validate(dto: any, files:Array<Express.Multer.File>): ValidationError[] {
        const isValidateForUpdate = dto.id !== undefined; //FIXME: This is a hack, since we are using PUT for update. Once we support PATCH, this will be removed
        const fieldFiles = files.filter(file => file.fieldname === this.options.fieldName);
        return this.applyValidations(fieldFiles, isValidateForUpdate);
    }

    private applyValidations(fieldFiles:Array<Express.Multer.File>, isValidateForUpdate: boolean): ValidationError[] {
        switch (this.options.type) {
            case SolidMediaType.mediaSingle:
                return this.validateMediaSingle(fieldFiles, isValidateForUpdate);
            case SolidMediaType.mediaMultiple:
                return this.validateMediaMultiple(fieldFiles, isValidateForUpdate);
            default:
                return [];
        }
    }

    private validateMediaSingle(fieldFiles:Array<Express.Multer.File>, isValidateForUpdate: boolean): ValidationError[] {
        const errors: ValidationError[] = [];
        if (!isValidateForUpdate && this.options.required && fieldFiles.length === 0) {
            errors.push({
                field: this.options.fieldName,
                error: `${this.options.fieldName} is required`
            });
        }
        if (fieldFiles.length > 1) {
            errors.push({
                field: this.options.fieldName,
                error: `${this.options.fieldName} must be a single file`
            });
        }
        return errors;
    }

    private validateMediaMultiple(fieldFiles:Array<Express.Multer.File>, isValidateForUpdate: boolean): ValidationError[] {    
        const errors: ValidationError[] = [];
        if (!isValidateForUpdate && this.options.required && fieldFiles.length === 0) {
            errors.push({
                field: this.options.fieldName,
                error: `${this.options.fieldName} is required`
            });
        }
        return errors;
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
}
