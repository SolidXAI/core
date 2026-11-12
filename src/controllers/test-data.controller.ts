import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ModuleTestDataService, TestDataSpec } from 'src/seeders/module-test-data.service';

export const TEST_DATA_ENDPOINT_FLAG = 'SOLIDX_TEST_DATA_ENDPOINT_ENABLED';

/**
 * Loads `testing` roles, users and data into this application's database, idempotently.
 * Test Hub calls this before a run so seed data is present for the run. Disabled unless
 * SOLIDX_TEST_DATA_ENDPOINT_ENABLED=true. Uses the default auth guards, so the caller needs
 * a Bearer token or API key whose role has TestDataController.load. One load runs at a time per process: a
 * second request while one is running gets 409, so two loads can never both create the same record.
 */
@Controller('test-data')
@ApiTags('Solid Core')
export class TestDataController {
  private static loadInProgress = false;

  constructor(private readonly moduleTestDataService: ModuleTestDataService) {}

  @Post('load')
  @HttpCode(HttpStatus.OK)
  async load(@Body() body: { testing?: TestDataSpec }) {
    if (process.env[TEST_DATA_ENDPOINT_FLAG] !== 'true') {
      throw new NotFoundException();
    }
    if (!body || typeof body.testing !== 'object' || body.testing === null) {
      throw new BadRequestException('Request body must contain a "testing" object.');
    }

    if (TestDataController.loadInProgress) {
      throw new ConflictException('A test data load is already in progress.');
    }

    TestDataController.loadInProgress = true;
    try {
      return await this.moduleTestDataService.loadTestData(body.testing);
    } catch (error) {
      throw new UnprocessableEntityException(error instanceof Error ? error.message : 'Test data load failed.');
    } finally {
      TestDataController.loadInProgress = false;
    }
  }
}
