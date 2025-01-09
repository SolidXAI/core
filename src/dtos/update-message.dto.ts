import { PartialType } from "@nestjs/swagger";
import { CreateMessageDto } from "./create-message.dto";


export class UpdateMessageDto extends PartialType(CreateMessageDto) {
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly elapsedMillis: number;
    readonly output: string;
    readonly error: string;
}