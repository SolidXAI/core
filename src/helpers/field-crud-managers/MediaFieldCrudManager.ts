import { FieldCrudManager, ValidationError } from "src/interfaces";
import { EXT_TO_MEDIA_TYPE, getLowercaseFileExtension, getUploadedFileName, isDangerousMediaFile, MediaCategory } from "src/constants/media-file-types";

export enum SolidMediaType {
    mediaSingle = 'mediaSingle',
    mediaMultiple = 'mediaMultiple'
}

export interface MediaFieldOptions {
    type: SolidMediaType;
    required: boolean | undefined | null;
    fieldName: string | undefined | null;
    mediaMaxSizeKb: number | undefined | null;
    mediaTypes: string[];
    mediaAllowedExtensions?: string[] | null;
    isUpdate: boolean | undefined | null;
}

type MediaType = MediaCategory;

const MIME_TO_MEDIA_TYPE: Record<string, MediaType> = {
    // Images
    'image/png': 'image',
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/webp': 'image',
    'image/gif': 'image',
    'image/bmp': 'image',
    'image/tiff': 'image',
    'image/heic': 'image',
    'image/heif': 'image',

    // Audio
    'audio/mpeg': 'audio',      // mp3
    'audio/mp3': 'audio',
    'audio/wav': 'audio',
    'audio/x-wav': 'audio',
    'audio/webm': 'audio',
    'audio/ogg': 'audio',
    'audio/aac': 'audio',
    'audio/mp4': 'audio',       // m4a often shows as audio/mp4
    'audio/x-m4a': 'audio',
    'audio/flac': 'audio',

    // Video
    'video/mp4': 'video',
    'video/mpeg': 'video',
    'video/webm': 'video',
    'video/ogg': 'video',
    'video/quicktime': 'video', // mov
    'video/x-msvideo': 'video', // avi
    'video/x-matroska': 'video',// mkv
    'video/3gpp': 'video',
    'video/3gpp2': 'video',

    // Documents / files (treat as "file")
    'application/pdf': 'pdf',
    'text/plain': 'file',
    'text/markdown': 'file',
    'application/json': 'file',
    'text/csv': 'file',

    // Office
    'application/msword': 'file', // doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file', // docx
    'application/vnd.ms-excel': 'file', // xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file', // xlsx
    'application/vnd.ms-powerpoint': 'file', // ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'file', // pptx,

    // Archives (optional)
    'application/zip': 'file',
    'application/x-zip-compressed': 'file',
    'application/x-rar-compressed': 'file',
    'application/x-7z-compressed': 'file',
};

export class MediaFieldCrudManager implements FieldCrudManager {

    constructor(private readonly options: MediaFieldOptions) {
    }

    private resolveMediaType(file: Express.Multer.File): MediaType | null {
        // Belt-and-braces: dangerous files are already rejected outright by
        // validateDangerousFiles, but never let one resolve to a usable category.
        if (isDangerousMediaFile(file)) {
            return null;
        }

        const ext = getLowercaseFileExtension(getUploadedFileName(file));
        const mt = (file.mimetype || '').toLowerCase().trim();
        if (mt && MIME_TO_MEDIA_TYPE[mt]) {
            return MIME_TO_MEDIA_TYPE[mt];
        }

        // Some libs may send "image/*" etc. Treat broad families safely.
        if (mt.startsWith('image/')) return 'image';
        if (mt.startsWith('audio/')) return 'audio';
        if (mt.startsWith('video/')) return 'video';

        // Fallback to extension if provided (also covers generic/unrecognized
        // mimetypes such as application/octet-stream).
        if (ext && EXT_TO_MEDIA_TYPE[ext]) {
            return EXT_TO_MEDIA_TYPE[ext];
        }

        return null;
    }

    validate(dto: any, files: Array<Express.Multer.File>): ValidationError[] {
        const fieldFiles = files.filter(file => file.fieldname === this.options.fieldName);
        return this.applyValidations(fieldFiles);
    }

    private applyValidations(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        // Runs for every media field type and regardless of the admin-configured mediaTypes
        // allowlist - a dangerous upload is never acceptable, so this must not sit behind
        // the optional type checks below.
        const errors = [
            ...this.validateDangerousFiles(fieldFiles),
            ...this.validateAllowedExtensions(fieldFiles),
        ];

        switch (this.options.type) {
            case SolidMediaType.mediaSingle:
                return [...errors, ...this.validateMediaSingle(fieldFiles)];
            case SolidMediaType.mediaMultiple:
                return [...errors, ...this.validateMediaMultiple(fieldFiles)];
            default:
                return errors;
        }
    }

    private validateDangerousFiles(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        return fieldFiles
            .filter(fieldFile => isDangerousMediaFile(fieldFile))
            .map(fieldFile => ({
                field: this.options.fieldName,
                error: `${this.options.fieldName} file type not allowed. ` +
                    `${getUploadedFileName(fieldFile) || 'File'} is a potentially dangerous file type.`
            }));
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
                error: `${this.options.fieldName} file type not allowed. ` +
                    `Allowed extensions: ${[...normalizedAllowed].join(', ')}.`
            }));
    }

    private validateMediaSingle(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const errors: ValidationError[] = [];
        if (!this.options.isUpdate && this.options.required && fieldFiles.length === 0) {
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
        // validate size
        if (this.options.mediaMaxSizeKb) {
            for (let i = 0; i < fieldFiles.length; i++) {
                const fieldFile = fieldFiles[i];
                const fieldFileSizeInBytes = Math.ceil(fieldFile.size / 1024);
                if (fieldFileSizeInBytes > this.options.mediaMaxSizeKb) {
                    errors.push({
                        field: this.options.fieldName,
                        error: `${this.options.fieldName} with size ${fieldFileSizeInBytes} KB exceeds max size limit of ${this.options.mediaMaxSizeKb} KB`
                    });
                }
            }
        }
        // validate type
        if (this.options.mediaTypes && this.options.mediaTypes.length > 0) {
            const allowedFileTypes = this.options.mediaTypes as MediaType[];

            for (let i = 0; i < fieldFiles.length; i++) {
                const fieldFile = fieldFiles[i];

                const resolvedType = this.resolveMediaType(fieldFile);
                if (!resolvedType || !allowedFileTypes.includes(resolvedType)) {
                    errors.push({
                        field: this.options.fieldName,
                        error: `${this.options.fieldName} file type not allowed. ` +
                            `Allowed: ${allowedFileTypes.join(', ')}. ` +
                            `Received mimetype: ${fieldFile.mimetype}${resolvedType ? ` (mapped to ${resolvedType})` : ''}`
                    });
                }
            }
        }

        return errors;
    }

    private validateMediaMultiple(fieldFiles: Array<Express.Multer.File>): ValidationError[] {
        const errors: ValidationError[] = [];
        if (!this.options.isUpdate && this.options.required && fieldFiles.length === 0) {
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
