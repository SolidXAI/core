import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class MetadataExplorerWriteDto {
    @ApiProperty({
        description: "Arbitrary JSON value to persist for the full metadata document or a section",
        required: false,
    })
    @IsOptional()
    value?: any;
}
