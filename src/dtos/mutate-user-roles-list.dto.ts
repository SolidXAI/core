import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class MutateUserRolesBulkDto {
    @ApiProperty({ description: "The username" })
    @IsString()
    @IsNotEmpty()
    readonly username: string;

    @ApiProperty({ example: [] })
    @IsString({ each: true })
    @IsNotEmpty()
    readonly roleNames: string[];
}
