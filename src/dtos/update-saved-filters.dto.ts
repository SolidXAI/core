import { IsInt,IsOptional, IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSavedFiltersDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    filterQueryJson: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    name: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isPrivate: boolean;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "This is the user id field" })
    userId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "This is the user id field" })
    userUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "This is the model related to saved filter." })
    modelId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "This is the model related to saved filter." })
    modelUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "This is the view related to saved filter." })
    viewId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "This is the view related to saved filter." })
    viewUserKey: string;
}