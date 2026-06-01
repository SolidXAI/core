import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateChatterNoteMessageDto {
    @IsString()
    @IsOptional()
    @ApiProperty()
    messageBody: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ required: false, description: 'Comma-separated media IDs to remove from this note.' })
    removeAttachmentIds?: string;
}
