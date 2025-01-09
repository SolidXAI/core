import { FieldMetadata } from "src/entities/field-metadata.entity";
import { FieldCrudManager, ValidationError } from "src/interfaces";
export declare enum MediaType {
    mediaSingle = "mediaSingle",
    mediaMultiple = "mediaMultiple"
}
export interface MediaFieldOptions {
    type: MediaType;
    required: boolean | undefined | null;
}
export declare class MediaFieldCrudManager implements FieldCrudManager {
    readonly fieldMetadata: FieldMetadata;
    private options;
    constructor(fieldMetadata: FieldMetadata);
    validate(dto: any, files: Array<Express.Multer.File>): ValidationError[];
    private applyValidations;
    private validateMediaSingle;
    private validateMediaMultiple;
    transformForCreate(dto: any): any;
}
