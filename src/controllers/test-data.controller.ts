import {
  BadRequestException,
  Body,
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
 * a Bearer token or API key whose role has TestDataController.load.
 */
@Controller('test-data')
@ApiTags('Solid Core')
export class TestDataController {
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

    try {
      return await this.moduleTestDataService.loadTestData(body.testing);
    } catch (error) {
      throw new UnprocessableEntityException(error instanceof Error ? error.message : 'Test data load failed.');
    }
  }
}
