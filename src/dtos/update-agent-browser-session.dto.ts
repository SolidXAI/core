import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAgentBrowserSessionDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    sessionId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    sessionUserKey: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    leaseId: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    containerName: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    steelSessionId: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    afterCursor: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    eventsCursor: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    epoch: number;

    @IsOptional()
    @IsString()
    @ApiProperty()
    activeTab: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    currentUrl: string;

    @IsOptional()
    @IsIn(['agent', 'human'])
    @ApiProperty()
    controlMode: string;

    @IsOptional()
    @IsIn(['active', 'state_saved', 'released'])
    @ApiProperty()
    status: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    @ApiProperty()
    handoffExpiresAt: Date;
}
