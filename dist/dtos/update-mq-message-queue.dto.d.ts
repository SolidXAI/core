import { UpdateMqMessageDto } from 'src/dtos/update-mq-message.dto';
export declare class UpdateMqMessageQueueDto {
    id: number;
    name: string;
    description: string;
    mqMessages: UpdateMqMessageDto[];
    mqMessageIds: number[];
    mqMessageCommand: string;
}
