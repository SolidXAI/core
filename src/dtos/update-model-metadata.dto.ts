import { PartialType } from "@nestjs/mapped-types";
import { CreateModelMetadataDto } from "./create-model-metadata.dto";
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UpdateFieldMetaDataDto } from "./update-field-metadata.dto";
import { Type } from "class-transformer";

export class UpdateModelMetaDataDto extends PartialType(CreateModelMetadataDto) {

    @IsNumber()
    @IsOptional()
    id?: number;

    @ApiProperty({ description: "Fields associated with this model" })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateFieldMetaDataDto)  // Use UpdateFieldMetaDataDto
    @IsOptional()  // This can be optional if needed
    fields?: UpdateFieldMetaDataDto[];  // Use the UpdateFieldMetaDataDto type

}
