import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsNotEmpty, IsDate } from 'class-validator';

export class UpdateWorkflowSecretDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Global secret key used in workflow expressions, for example smtp.password." })
    key: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Human-facing secret name shown in the admin UI." })
    displayName: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Operational notes describing where this secret is used." })
    description: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Plain value supplied by an admin. It is encrypted before storage." })
    value: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "How the decrypted value should be coerced for workflow runtime usage." })
    valueType: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty({ description: "Secret lifecycle status." })
    status: string;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "When this secret was last rotated." })
    lastRotatedAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty({ description: "When this secret was last resolved by workflow runtime." })
    lastAccessedAt: Date;
}
