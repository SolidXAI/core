import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { TestQueuePublisher } from '../jobs/queue-test-publisher.service';
import { TestQueueDbPublisher } from 'src/jobs/database/queue-test-db-publisher.service';


@Auth(AuthType.None)
@Controller('queues')
@ApiTags("Queues")
export class QueuesTestController {

    constructor(
        private readonly publisherRmq: TestQueuePublisher,
        private readonly publisherDb: TestQueueDbPublisher
    ) { }

    @Public()
    @Get(':messageBroker')
    async getHello(@Param('messageBroker') messageBroker: string) {
        const pubsubMessage = 'A hopping-good time!';
        const m = {
            payload: {
                firstName: 'Harish',
                lastName: 'Patel',
                age: 40
            },
            parentEntity: 'feeType',
            parentEntityId: 23,
        };
        if (messageBroker === 'rabbitmq') {
            await this.publisherRmq.publish(m);
        }
        if (messageBroker === 'database') {
            await this.publisherDb.publish(m);
        }

        return {};
    }
}
