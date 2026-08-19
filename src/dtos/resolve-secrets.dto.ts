import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ResolveSecretsDto {
    @IsArray()
    @ArrayNotEmpty()
    // Bounded so a single call cannot drain the store in one request.
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @ApiProperty({
        description:
            'Secret keys to resolve, exactly as stored. Keys must be named explicitly — there is no wildcard or list-all form.',
        example: ['payments.apiKey', 'smtp.password'],
    })
    keys: string[];
}
