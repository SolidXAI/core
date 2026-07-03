import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from 'src/decorators/auth.decorator';
import { Public } from 'src/decorators/public.decorator';
import { AuthType } from 'src/enums/auth-type.enum';
import { assertTestLifecycleAllowed } from 'src/helpers/test-lifecycle.helper';
import { PrepareRequestDto, PrepareResponse } from 'src/dtos/test-lifecycle.dto';
import { TestLifecycleService } from 'src/services/test-lifecycle.service';

/**
 * Client-side test-environment "prepare-hook". An orchestrator (testingHub) POSTs here
 * BEFORE a run to reset + seed + load THIS app's test database. DESTRUCTIVE — every
 * Solid app inherits it, but it is hard-gated by assertTestLifecycleAllowed
 * (SOLID_TEST_LIFECYCLE_ENABLED + non-prod + optional shared secret) so it can never
 * touch a production DB. Runs synchronously in-process (no restart) and returns when
 * the test DB is clean and seeded.
 */
@Auth(AuthType.None)
@Controller('test-lifecycle')
@ApiTags('Solid Core')
export class TestLifecycleController {
  constructor(private readonly testLifecycleService: TestLifecycleService) {}

  @Public()
  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  async prepare(
    @Body() dto: PrepareRequestDto,
    @Headers('x-test-prepare-secret') secret?: string,
  ): Promise<PrepareResponse> {
    assertTestLifecycleAllowed(secret);
    return this.testLifecycleService.prepare(dto ?? ({} as PrepareRequestDto));
  }
}
