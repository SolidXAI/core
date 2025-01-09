import { CreateMessageDto } from "./create-message.dto";
declare const UpdateMessageDto_base: import("@nestjs/common").Type<Partial<CreateMessageDto>>;
export declare class UpdateMessageDto extends UpdateMessageDto_base {
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly elapsedMillis: number;
    readonly output: string;
    readonly error: string;
}
export {};
