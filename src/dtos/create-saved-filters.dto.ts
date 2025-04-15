import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsOptional, IsNotEmpty, IsBoolean, IsInt } from 'class-validator';

export class CreateSavedFiltersDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    filterQueryJson: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isPrivate: boolean = false;
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