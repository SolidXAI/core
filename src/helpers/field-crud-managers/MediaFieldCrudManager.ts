import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EXT_TO_MEDIA_TYPES, getLowercaseFileExtension, getUploadedFileName, isDangerousMediaFile, MediaCategory, MIME_TO_MEDIA_TYPE } from "src/constants/media-file-types";

export enum SolidMediaType {
    mediaSingle = 'mediaSingle',
    mediaMultiple = 'mediaMultiple'
}

export interface MediaFieldOptions {
    type: SolidMediaType;
    required: boolean | undefined | null;
    fieldName: string | undefined | null;
    fieldLabel?: string | undefined | null;
    mediaMaxSizeKb: number | undefined | null;
    mediaTypes: string[];
    mediaAllowedExtensions?: string[] | null;
    isUpdate: boolean | undefined | null;
}

type MediaType = MediaCategory;

export class MediaFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: MediaFieldOptions) {
    }

    private getFieldLabel(): string {
        return this.options.fieldLabel || this.options.fieldName || 'File';
    }

    private resolveMediaType(file: Express.Multer.File): MediaType | null {
        // Belt-and-braces: dangerous files are already rejected outright by
        // validateDangerousFiles, but never let one resolve to a usable category.
        if (isDangerousMediaFile(file)) {
            return null;
        }

        // Extension is authoritative: a declared mimetype is fully attacker-controlled and
        // proved insufficient on its own (a .msi uploaded as image/png previously resolved to
        // 'image', since the mimetype match short-circuited before the extension was ever
        // checked). The extension must independently resolve to a known-safe category before
        // anything is accepted - not merely "not on the denylist".
        // Read the file extension from the uploaded filename, for example "song.ogg" -> "ogg".
        const ext = getLowercaseFileExtension(getUploadedFileName(file));

        // Find every media category that supports this extension.
        // An extension can belong to multiple categories, for example .ogg can be audio or video.
        const extToMediaTypes = ext ? EXT_TO_MEDIA_TYPES[ext] : undefined;

        // Reject files whose extension is not part of the supported media definitions.
        if (!extToMediaTypes || extToMediaTypes.length === 0) {
            return null;
        }

        // The mimetype may only confirm or veto what the extension already established, never
        // grant a category on its own. A mimetype that doesn't resolve to anything (e.g.
        // application/octet-stream) has no opinion and is treated as agreeing.
        const mt = (file.mimetype || '').toLowerCase().trim();
        const mimeToMediaTypes = MIME_TO_MEDIA_TYPE[mt]
            ?? (mt.startsWith('image/') ? 'image' : mt.startsWith('audio/') ? 'audio' : mt.startsWith('video/') ? 'video' : undefined);
        // When the extension is shared, the MIME type identifies the actual category:
        // audio/ogg becomes audio, while video/ogg becomes video.
        if (mimeToMediaTypes && !extToMediaTypes.includes(mimeToMediaTypes)) {
            return null;
        }

        return mimeToMediaTypes || extToMediaTypes[0];
    }

    validate(dto: any, files: Array<Express.Multer.File>): ValidationError[] {
        const fieldFiles = files.filter(file => file.fieldname === this.options.fieldName);
        return this.applyValidations(fieldFiles);
    }

    private applyValidations(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        // A dangerous upload is never acceptable, regardless of admin config, so this is the
        // only check that sits outside validateCommon() and can't be skipped either way below.
        const dangerousFileErrors = this.validateDangerousFiles(fieldFiles);

        switch (this.options.type) {
            case SolidMediaType.mediaSingle:
                return [...dangerousFileErrors, ...this.validateMediaSingle(fieldFiles)];
            case SolidMediaType.mediaMultiple:
                return [...dangerousFileErrors, ...this.validateMediaMultiple(fieldFiles)];
            default:
                return dangerousFileErrors;
        }
    }

    private validateDangerousFiles(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        return fieldFiles
            .filter(fieldFile => isDangerousMediaFile(fieldFile))
            .map(fieldFile => ({
                field: this.options.fieldName,
                error: `${this.getFieldLabel()} file type not allowed. ` +
                    `${getUploadedFileName(fieldFile) || 'File'} is a potentially dangerous file type.`
            }));
    }

    // Every optional, admin-configured, per-field check - no-ops when its setting is unset -
    // shared between mediaSingle and mediaMultiple so neither can drift out of sync with it.
    private validateCommon(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        return [
            ...this.validateRequired(fieldFiles),
            ...this.validateSize(fieldFiles),
            ...this.validateTypes(fieldFiles),
            ...this.validateAllowedExtensions(fieldFiles),
        ];
    }

    private validateRequired(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const errors: ValidationError[] = [];
        if (!this.options.isUpdate && this.options.required && fieldFiles.length === 0) {
            errors.push({
                field: this.options.fieldName,
                error: `${this.getFieldLabel()} is required`
            });
        }
        return errors;
    }

    private validateSize(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const errors: ValidationError[] = [];
        if (this.options.mediaMaxSizeKb) {
            for (let i = 0; i < fieldFiles.length; i++) {
                const fieldFile = fieldFiles[i];
                const fieldFileSizeInBytes = Math.ceil(fieldFile.size / 1024);
                if (fieldFileSizeInBytes > this.options.mediaMaxSizeKb) {
                    errors.push({
                        field: this.options.fieldName,
                        error: `${this.getFieldLabel()} with size ${fieldFileSizeInBytes} KB exceeds max size limit of ${this.options.mediaMaxSizeKb} KB`
                    });
                }
            }
        }
        return errors;
    }

    private validateTypes(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const errors: ValidationError[] = [];
        if (this.options.mediaTypes && this.options.mediaTypes.length > 0) {
            const allowedFileTypes = this.options.mediaTypes as MediaType[];

            for (let i = 0; i < fieldFiles.length; i++) {
                const fieldFile = fieldFiles[i];

                const resolvedType = this.resolveMediaType(fieldFile);
                if (!resolvedType || !allowedFileTypes.includes(resolvedType)) {
                    errors.push({
                        field: this.options.fieldName,
                        error: `${this.getFieldLabel()} file type not allowed. ` +
                            `Allowed: ${allowedFileTypes.join(', ')}. ` +
                            `Received mimetype: ${fieldFile.mimetype}${resolvedType ? ` (mapped to ${resolvedType})` : ''}`
                    });
                }
            }
        }
        return errors;
    }

    private validateAllowedExtensions(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const allowed = this.options.mediaAllowedExtensions;
        if (!allowed || allowed.length === 0) {
            return [];
        }

        const normalizedAllowed = new Set(allowed.map(ext => ext.toLowerCase().replace(/^\./, '')));
        return fieldFiles
            .filter(fieldFile => {
                const ext = getLowercaseFileExtension(getUploadedFileName(fieldFile));
                return !ext || !normalizedAllowed.has(ext);
            })
            .map(fieldFile => ({
                field: this.options.fieldName,
                error: `${this.getFieldLabel()} file type not allowed. ` +
                    `Allowed extensions: ${[...normalizedAllowed].join(', ')}.`
            }));
    }

    private validateMediaSingle(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const errors = this.validateCommon(fieldFiles);
        if (fieldFiles.length > 1) {
            errors.push({
                field: this.options.fieldName,
                error: `${this.getFieldLabel()} must be a single file`
            });
        }
        return errors;
    }

    private validateMediaMultiple(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        return this.validateCommon(fieldFiles);
    }

    transformForCreate(dto: any): any {
        return dto;
    }

    // Validation to be applied
}
