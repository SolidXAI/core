import { PartialType } from "@nestjs/swagger";
import { CreateMessageDto } from "./create-message.dto";
import { IsOptional } from "class-validator";


export class UpdateMessageDto extends PartialType(CreateMessageDto) {
    @IsOptional()
    readonly startedAt: Date;
    @IsOptional()
    readonly finishedAt: Date;
    @IsOptional()
    readonly elapsedMillis: number;
    @IsOptional()
    readonly output: string;
    @IsOptional()
    readonly error: string;
}