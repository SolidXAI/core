import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch, Headers, UnauthorizedException } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AgentProcessService } from '../services/agent-process.service';
import { CreateAgentProcessDto } from '../dtos/create-agent-process.dto';
import { UpdateAgentProcessDto } from '../dtos/update-agent-process.dto';
import { ShowSoftDeleted } from '../enums/show-soft-deleted.enum';

@ApiTags('Agent Hub')
@Controller('agent-process')
export class AgentProcessController {
  constructor(private readonly service: AgentProcessService) {}

  private requireAuthorization(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('A SolidX bearer token is required.');
    }
    return authorization;
  }

  /** Proxies runtime process state from AgentHub; SolidX remains the browser-facing API. */
  @ApiBearerAuth("jwt")
  @Get('/manager/processes')
  listRuntimeProcesses(@Headers('authorization') authorization?: string) {
    return this.service.listRuntimeProcesses(this.requireAuthorization(authorization));
  }

  @ApiBearerAuth("jwt")
  @Post('/manager/processes/:processId/stop')
  stopRuntimeProcess(@Param('processId') processId: string, @Headers('authorization') authorization?: string) {
    return this.service.stopRuntimeProcess(processId, this.requireAuthorization(authorization));
  }

  @ApiBearerAuth("jwt")
  @Post('/manager/processes/:processId/restart')
  restartRuntimeProcess(@Param('processId') processId: string, @Headers('authorization') authorization?: string) {
    return this.service.restartRuntimeProcess(processId, this.requireAuthorization(authorization));
  }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateAgentProcessDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateAgentProcessDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateAgentProcessDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateAgentProcessDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files, true);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk-recover')
  async recoverMany(@Body() ids: number[]) {
    return this.service.recoverMany(ids);
  }

  @ApiBearerAuth("jwt")
  @Get('/recover/:id')
  async recover(@Param('id') id: number) {
    return this.service.recover(id);
  }
    
  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'showSoftDeleted', required: false, enum: ShowSoftDeleted })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'fields', required: false, type: Array })
  @ApiQuery({ name: 'sort', required: false, type: Array }) 
  @ApiQuery({ name: 'groupBy', required: false, type: Array })
  @ApiQuery({ name: 'populate', required: false, type: Array })
  @ApiQuery({ name: 'populateMedia', required: false, type: Array })
  @ApiQuery({ name: 'filters', required: false, type: Array })

  @Get()
  async findMany(@Query() query: any) { 
    return this.service.find(query);  
  }

  @ApiBearerAuth("jwt")
  @Get(':id')
  async findOne(@Param('id') id: string, @Query() query: any) {
    return this.service.findOne(+id, query);
  }

  @ApiBearerAuth("jwt")
  @Delete('/bulk')
  async deleteMany(@Body() ids: number[]) {
    return this.service.deleteMany(ids);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.service.delete(id);
  }



}
