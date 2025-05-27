import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch, Res, InternalServerErrorException } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExportTemplateService } from '../services/export-template.service';
import { CreateExportTemplateDto } from '../dtos/create-export-template.dto';
import { UpdateExportTemplateDto } from '../dtos/update-export-template.dto';
import { Response } from 'express';

@ApiTags('Solid') 
@Controller('export-template') //FIXME: Change this to the model plural name 
export class ExportTemplateController { 
  constructor(private readonly service: ExportTemplateService) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateExportTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateExportTemplateDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateExportTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateExportTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files, true);
  }
    
  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'showSoftDeleted', required: false, type: Boolean })
  @ApiQuery({ name: 'showOnlySoftDeleted', required: false, type: Boolean })
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
  @Post(':id/startExport/sync')
  async startExportSync(@Param('id') id: number, @Body() body: any, @Res() res: Response) {
    const filters = body?.filters;
    const exportFileInfo = await this.service.startExportSync(+id, filters);
    if (exportFileInfo.exportStream === null) {
      throw new InternalServerErrorException("Export stream is null");
    }

    // ✅ Set response headers for streaming
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileInfo.fileName}"`);
    res.setHeader('Content-Type', exportFileInfo.mimeType);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    // Pipe the strea to the response as an excel file
    exportFileInfo.exportStream.pipe(res);
  }

  @ApiBearerAuth("jwt")
  @Post(':id/startExport/async')
  async startExportAsync(@Param('id') id: number, @Body() body: any) {
    const filters = body?.filters;
    return this.service.startExportAsync(+id, filters);
  }

}
