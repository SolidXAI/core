export declare class CreateMqMessageDto {
    retryCount: number;
    retryInterval: number;
    messageType: string;
    stage: string;
    startedAt: Date;
    finishedAt: Date;
    elapsedMillis: number;
    input: any;
    output: any;
    error: any;
    parentEntityId: number;
    parentEntity: string;
    mqMessageQueueId: number;
}
