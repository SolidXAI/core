import { QueuesModuleOptions } from "../interfaces";
export interface QueueMessage<T> {
    messageId?: string;
    payload: T;
    parentEntityId?: any;
    parentEntity?: string;
    retryCount?: number;
    retryInterval?: number;
    currentRetry?: number;
}
export type QueueServiceRole = 'publisher' | 'subscriber' | 'both';
export interface QueuePublisher<T> {
    options(): QueuesModuleOptions;
    publish(message: QueueMessage<T>): Promise<string>;
}
export interface QueueSubscriber<T> {
    options(): QueuesModuleOptions;
    subscribe(message: QueueMessage<T>): void;
}
