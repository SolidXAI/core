import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WorkflowDefinitionService } from '../services/workflow-definition.service';
import { CreateWorkflowDefinitionDto } from '../dtos/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from '../dtos/update-workflow-definition.dto';
import { ExecuteWorkflowDto } from '../dtos/execute-workflow.dto';
import { WorkflowNodeRegistryService } from '../services/workflow/workflow-node-registry.service';
import { ValidateWorkflowDefinitionDto } from '../dtos/validate-workflow-definition.dto';

enum ShowSoftDeleted {
  INCLUSIVE = "inclusive",
  EXCLUSIVE = "exclusive",
}

@ApiTags('Solid Core')
@Controller('workflow-definition')
export class WorkflowDefinitionController {
  constructor(
    private readonly service: WorkflowDefinitionService,
    private readonly workflowNodeRegistry: WorkflowNodeRegistryService,
  ) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateWorkflowDefinitionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateWorkflowDefinitionDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }

  @ApiBearerAuth("jwt")
  @Post('by-key/:key/execute')
  executeByKey(@Param('key') key: string, @Body() executeDto: ExecuteWorkflowDto) {
    return this.service.executeWorkflowByKey(key, executeDto);
  }

  @ApiBearerAuth("jwt")
  @Post(':id/execute')
  execute(@Param('id') id: string, @Body() executeDto: ExecuteWorkflowDto) {
    return this.service.executeWorkflow(+id, executeDto);
  }

  @ApiBearerAuth("jwt")
  @Get('node-types')
  listNodeTypes() {
    return this.workflowNodeRegistry.list();
  }

  @ApiBearerAuth("jwt")
  @Post('validate')
  validate(@Body() validateDto: ValidateWorkflowDefinitionDto) {
    return this.service.validateWorkflowDefinition(validateDto.definitionYaml);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateWorkflowDefinitionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateWorkflowDefinitionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
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
