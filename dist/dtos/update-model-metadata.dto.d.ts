import { CreateModelMetadataDto } from "./create-model-metadata.dto";
import { UpdateFieldMetaDataDto } from "./update-field-metadata.dto";
declare const UpdateModelMetaDataDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateModelMetadataDto>>;
export declare class UpdateModelMetaDataDto extends UpdateModelMetaDataDto_base {
    id?: number;
    fields?: UpdateFieldMetaDataDto[];
}
export {};
