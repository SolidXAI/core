import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class MutateRolePermissionsDto {
    @ApiProperty({ description: "The name of a role" })
    @IsString()
    @IsNotEmpty()
    readonly roleName: string;

    @ApiProperty({ example: [] })
    @IsString({ each: true })
    readonly permissionNames: string[];
}
