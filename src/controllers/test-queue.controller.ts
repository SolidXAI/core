import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { PublisherFactory } from 'src/services/queues/publisher-factory.service';


@Auth(AuthType.None)
@Controller('queues')
@ApiTags("Queues")
export class TestQueueController {

    constructor(
        // private readonly publisherRmq: TestQueuePublisher,
        // private readonly publisherDb: TestQueuePublisherDatabase
        private readonly publisherFactory: PublisherFactory<any>
    ) { }

    @Public()
    @Get(':messageBroker/:timeoutSeconds')
    async getHello(@Param('messageBroker') messageBroker: string, @Param('timeoutSeconds') timeoutSeconds: number) {
        const pubsubMessage = 'A hopping-good time!';
        const m = {
            payload: {
                firstName: 'Harish',
                lastName: 'Patel',
                age: 40,
                timeoutSeconds: timeoutSeconds
            },
            parentEntity: 'feeType',
            parentEntityId: 23,
        };
        // if (messageBroker === 'rabbitmq') {
        //     await this.publisherRmq.publish(m);
        // }
        // if (messageBroker === 'database') {
        //     await this.publisherDb.publish(m);
        // }
        await this.publisherFactory.publish(m, 'TestQueuePublisher', messageBroker);

        return {};
    }
}
