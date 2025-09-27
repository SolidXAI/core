import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiInteractionService } from '../services/ai-interaction.service';
import { CreateAiInteractionDto } from '../dtos/create-ai-interaction.dto';
import { UpdateAiInteractionDto } from '../dtos/update-ai-interaction.dto';
import { InvokeAiPromptDto } from '../dtos/invoke-ai-prompt.dto';
import { ActiveUser } from 'src/decorators/active-user.decorator';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';

enum ShowSoftDeleted {
  INCLUSIVE = "inclusive",
  EXCLUSIVE = "exclusive",
}

@ApiTags('Solid Core')
@Controller('ai-interaction')
export class AiInteractionController {
  constructor(private readonly service: AiInteractionService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateAiInteractionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateAiInteractionDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateAiInteractionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateAiInteractionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
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

  @ApiBearerAuth("jwt")
  @Post('/trigger-mcp-client-job')
  async triggerMcpClientJob(@Body() dto: InvokeAiPromptDto, @ActiveUser() activeUser: ActiveUserData) {
    return this.service.triggerMcpClientJob(dto,activeUser.sub);
  }

  @ApiBearerAuth("jwt")
  @Post(':id/apply-solid-ai-interaction')
  async applySolidAiInteraction(@Param('id') id: number) {
    return this.service.applySolidAiInteraction(+id);
  }

  @ApiBearerAuth("jwt")
  @Post('/run-mcp-prompt')
  async runMcpPrompt(@Body() dto: InvokeAiPromptDto) {
    return this.service.runMcpPrompt(dto.prompt);
  }
}
