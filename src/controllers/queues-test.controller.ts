import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { TestQueuePublisher } from '../jobs/queue-test-publisher.service';
import { TestQueueDbPublisher } from 'src/jobs/queue-test-db-publisher.service';


@Auth(AuthType.None)
@Controller('queues')
@ApiTags("Queues")
export class QueuesTestController {

    constructor(
        private readonly publisher: TestQueuePublisher,
        private readonly publisherDb: TestQueueDbPublisher
    ) { }

    @Public()
    @Get()
    async getHello() {
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
        await this.publisherDb.publish(m);

        return {};
    }
}
