import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAgentBrowserSessionDto {
    @IsNotEmpty()
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
    epoch: number = 0;

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
    controlMode: string = 'agent';

    @IsOptional()
    @IsIn(['active', 'state_saved', 'released'])
    @ApiProperty()
    status: string = 'active';

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    @ApiProperty()
    handoffExpiresAt: Date;
}
