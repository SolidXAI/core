import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsOptional, IsNotEmpty, IsBoolean, IsInt, IsJSON } from 'class-validator';

export class CreateSavedFiltersDto {
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    filterQueryJson: any;

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

    @IsString()
    @IsOptional()
    @ApiProperty({ description: "A brief description providing additional context about the saved filter’s purpose or usage within the view." })
    description: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isSeeded: boolean = false;


}
