import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { TestQueuePublisher } from '../jobs/queue-test-publisher.service';


@Auth(AuthType.None)
@Controller('queues')
@ApiTags("Queues")
export class QueuesTestController {

    constructor(private readonly publisher: TestQueuePublisher) { }

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
            parentEntity: 'Address',
            parentEntityId: 23,
        };
        await this.publisher.publish(m);

        return {};
    }
}
