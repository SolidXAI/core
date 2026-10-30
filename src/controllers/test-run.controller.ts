import { randomUUID } from 'crypto';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { PublisherFactory } from 'src/services/queues/publisher-factory.service';
import {
  TestRunJobPayload,
  TestRunRequestDto,
} from 'src/dtos/test-run-request.dto';

/**
 * Triggers a BDD test run from CUSTOM INPUT (inline scenarios). Enqueues the run and
 * returns immediately; a worker (QUEUES_SERVICE_ROLE=subscriber) executes it and
 * streams lifecycle webhooks to `dto.webhookUrl`. Reusable by any Solid app
 * (testingHub calls this from its StartRunController).
 */
@Auth(AuthType.None)
@Controller('test-runs')
@ApiTags('Solid Core')
export class TestRunController {
  constructor(private readonly publisherFactory: PublisherFactory<TestRunJobPayload>) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  // Accept the raw body (not the typed DTO) so the global ValidationPipe's
  // implicit-conversion does not coerce inline scenario objects into empty arrays.
  async trigger(@Body() dto: TestRunRequestDto & Record<string, any>) {
    const runId = randomUUID();
    const jobId = await this.publisherFactory.publish(
      {
        payload: { ...dto, runId },
        parentEntity: 'testRun',
      },
      'TestRunQueuePublisher',
      dto.broker,
    );

    return { runId, jobId, status: 'queued' };
  }
}
