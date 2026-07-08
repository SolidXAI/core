import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AgentService } from '../services/agent.service';

class ReadOnlySqlDto {
  @ApiProperty({ example: 'SELECT 1', description: 'A single read-only SQL statement (SELECT / WITH / EXPLAIN / SHOW).' })
  sql!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    required: false,
    description: 'Optional positional bind parameters for the statement.',
  })
  params?: unknown[];
}

/**
 * Agent-facing endpoints (only used by the agent / MCP in embedded PGlite mode
 * where the agent holds no direct DB connection). Runs a validated read-only
 * statement on core's owned default DataSource and exposes a lightweight
 * information_schema introspection.
 *
 * Route prefix `agent` becomes `/api/agent` once the global `api` prefix is
 * applied by the bootstrap helper.
 */
@ApiTags('Solid Core')
@ApiBearerAuth('jwt')
@Controller('agent')
export class AgentController {
  constructor(private readonly service: AgentService) {}

  @Post('/read-only-sql')
  runReadOnlySql(@Body() body: ReadOnlySqlDto) {
    return this.service.runReadOnlySql(body?.sql, body?.params);
  }

  @Get('/introspect')
  introspect() {
    return this.service.introspect();
  }
}