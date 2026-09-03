import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WorkflowExecutionService } from '../services/workflow-execution.service';
import { CreateWorkflowExecutionDto } from '../dtos/create-workflow-execution.dto';
import { UpdateWorkflowExecutionDto } from '../dtos/update-workflow-execution.dto';
import { WorkflowRuntimeService } from '../services/workflow/workflow-runtime.service';

import { ShowSoftDeleted } from '../enums/show-soft-deleted.enum';

@ApiTags('Solid Core')
@Controller('workflow-execution')
export class WorkflowExecutionController {
  constructor(
    private readonly service: WorkflowExecutionService,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
  ) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateWorkflowExecutionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateWorkflowExecutionDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateWorkflowExecutionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateWorkflowExecutionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
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
  @Get(':id/status')
  async getExecutionStatus(@Param('id') id: string) {
    return this.workflowRuntimeService.getExecutionStatus(+id);
  }

  @ApiBearerAuth("jwt")
  @Get(':id/output/last-step')
  async getLastStepOutput(@Param('id') id: string) {
    return this.workflowRuntimeService.getLastStepOutput(+id);
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'latest', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Get(':id/output/step/:stepNameOrId')
  async getStepOutput(
    @Param('id') id: string,
    @Param('stepNameOrId') stepNameOrId: string,
    @Query() query: any,
  ) {
    return this.workflowRuntimeService.getStepOutput(+id, stepNameOrId, {
      latest: query.latest !== undefined ? query.latest !== 'false' : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined,
      offset: query.offset !== undefined ? Number(query.offset) : undefined,
    });
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
