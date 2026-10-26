import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AgentUserMemoryService } from 'src/services/agent-user-memory.service';
import { CreateAgentUserMemoryDto } from 'src/dtos/create-agent-user-memory.dto';
import { UpdateAgentUserMemoryDto } from 'src/dtos/update-agent-user-memory.dto';
import { ShowSoftDeleted } from 'src/enums/show-soft-deleted.enum';

@ApiTags('Agent Hub')
@Controller('agent-user-memory')
export class AgentUserMemoryController {
  constructor(private readonly service: AgentUserMemoryService) {}

  @ApiBearerAuth('jwt') @Post() @UseInterceptors(AnyFilesInterceptor())
  create(@Body() dto: CreateAgentUserMemoryDto, @UploadedFiles() files: Array<Express.Multer.File>) { return this.service.create(dto, files); }

  @ApiBearerAuth('jwt') @Post('/bulk') @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() dtos: CreateAgentUserMemoryDto[], @UploadedFiles() files: Array<Express.Multer.File>[]) { return this.service.insertMany(dtos, files); }

  @ApiBearerAuth('jwt') @Put(':id') @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() dto: UpdateAgentUserMemoryDto, @UploadedFiles() files: Array<Express.Multer.File>) { return this.service.update(id, dto, files); }

  @ApiBearerAuth('jwt') @Patch(':id') @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() dto: UpdateAgentUserMemoryDto, @UploadedFiles() files: Array<Express.Multer.File>) { return this.service.update(id, dto, files, true); }

  @ApiBearerAuth('jwt') @ApiQuery({ name: 'showSoftDeleted', required: false, enum: ShowSoftDeleted }) @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'offset', required: false, type: Number }) @ApiQuery({ name: 'fields', required: false, type: Array }) @ApiQuery({ name: 'sort', required: false, type: Array }) @ApiQuery({ name: 'groupBy', required: false, type: Array }) @ApiQuery({ name: 'populate', required: false, type: Array }) @ApiQuery({ name: 'populateMedia', required: false, type: Array }) @ApiQuery({ name: 'filters', required: false, type: Array })
  @Get() findMany(@Query() query: any) { return this.service.find(query); }

  @ApiBearerAuth('jwt') @Get(':id') findOne(@Param('id') id: string, @Query() query: any) { return this.service.findOne(+id, query); }
  @ApiBearerAuth('jwt') @Delete('/bulk') deleteMany(@Body() ids: number[]) { return this.service.deleteMany(ids); }
  @ApiBearerAuth('jwt') @Delete(':id') delete(@Param('id') id: number) { return this.service.delete(id); }
}
