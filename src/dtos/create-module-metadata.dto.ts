import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { CreateModelMetadataDto } from "./create-model-metadata.dto";
import { IsNotInEnum } from "src/decorators/is-not-in-enum.decorator";
import { RESERVED_SOLID_KEYWORDS } from "src/helpers/solid-registry";

export class CreateModuleMetadataDto {
    @ApiProperty({ description: "Name of your module" })
    @Matches(/[a-z]+(-[a-z]+)*/, {
        message: "Only kebab case allowed for module name, also only lower case."
    })
    @IsNotInEnum(RESERVED_SOLID_KEYWORDS)
    readonly name: string;

    @ApiProperty({ description: "Display name of your module" })
    @IsString()
    readonly displayName: string;

    @ApiProperty({ description: "Describe your module" })
    @IsString()
    readonly description: string;

    @ApiProperty({ description: "Icon file to be used for your module, if file specified then this field can be empty. Else if you have a preuploaded Icon somewhere you can simply specify the Url here. " })
    @IsString()
    @IsOptional()
    menuIconUrl: string;

    @ApiProperty({ description: "The default data source to use with this module" })
    // @IsEnum(DataSource)
    @IsOptional()
    readonly defaultDataSource: string;

    @ApiProperty({ description: "Fields associated with this model" })
    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateModelMetadataDto)
    models: CreateModelMetadataDto[];

    @ApiProperty({ description: 'System modules are not included in the code generation, the assumption being that system modules have manually written code.', })
    @IsBoolean()
    isSystem: boolean;


    @ApiProperty({ description: "The Position of Module in Menu " })
    // @IsEnum(DataSource)
    @IsOptional()
    @IsNumber()
    menuSequenceNumber? :number

}
