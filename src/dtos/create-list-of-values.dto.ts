import { ApiProperty } from "@nestjs/swagger";

export class CreateListOfValuesDto {

    @ApiProperty({ description: "Type of the LOV" })
    readonly type : string;

    @ApiProperty({ description: "Value of the LOV" })
    readonly value: string;

    @ApiProperty({ description: "Display of the LOV" })
    readonly display: string;

    @ApiProperty({ description: "Description of the LOV" })
    readonly description: string;

    @ApiProperty({ description: "Default value of the LOV type" })
    readonly default : boolean;

    @ApiProperty({ description: "Sequence of the LOV" })
    readonly sequence: number;
}