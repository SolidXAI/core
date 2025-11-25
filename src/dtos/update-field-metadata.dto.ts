import { IsNumber, IsOptional } from "class-validator";
import { CreateFieldMetadataDto } from "./create-field-metadata.dto";

export class UpdateFieldMetaDataDto extends CreateFieldMetadataDto {
    
    @IsNumber()
    @IsOptional()
    id?: number;
}