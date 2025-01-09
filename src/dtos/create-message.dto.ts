import { ApiProperty } from "@nestjs/swagger";

export class CreateMessageDto {
    readonly retryCount: number;
    readonly retryInterval: number;
    readonly messageType: string;
    readonly stage: string;
    readonly input: string;
    readonly parentEntityId: number;
    readonly parentEntity: string;
    readonly queueName: string;
}
