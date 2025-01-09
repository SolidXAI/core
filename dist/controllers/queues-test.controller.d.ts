import { TestQueuePublisher } from '../jobs/queue-test-publisher.service';
export declare class QueuesTestController {
    private readonly publisher;
    constructor(publisher: TestQueuePublisher);
    getHello(): Promise<{}>;
}
