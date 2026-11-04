import { randomUUID } from 'crypto';
import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { cancelTestRun } from 'src/testing/runner/run-cancellation';
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

  /**
   * Stops a run this process is executing, by the `externalRunId` it was triggered with: the browser (or device
   * session) is closed and no further scenario starts. `canceled: false` means no such run is being executed
   * here (it already ended, or it has not been picked up yet).
   */
  @Public()
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Body() body: { externalRunId?: string | number }) {
    if (body?.externalRunId === undefined || body.externalRunId === null || body.externalRunId === '') {
      throw new BadRequestException('externalRunId is required');
    }
    return { canceled: cancelTestRun(String(body.externalRunId)) };
  }
}
