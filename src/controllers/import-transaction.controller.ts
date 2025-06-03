import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch, InternalServerErrorException, Res } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ImportFormat, ImportTransactionService } from '../services/import-transaction.service';
import { CreateImportTransactionDto } from '../dtos/create-import-transaction.dto';
import { UpdateImportTransactionDto } from '../dtos/update-import-transaction.dto';
import { Response } from 'express';

enum ShowSoftDeleted {
  INCLUSIVE = "inclusive",
  EXCLUSIVE = "exclusive",
}

@ApiTags('Solid Core')
@Controller('import-transaction')
export class ImportTransactionController {
  constructor(private readonly service: ImportTransactionService) {}

  @ApiBearerAuth("jwt")
  @Get('/import-template/:modelMetadataId/:format')
  async getImportTemplate(@Param('modelMetadataId') modelMetadataId: number, @Param('format') format: string, @Res() res: Response) {
    const importTemplateFileInfo =  await this.service.getImportTemplate(+modelMetadataId, format as ImportFormat);
    if (importTemplateFileInfo.stream === null) {
      throw new InternalServerErrorException("Sample Import template stream is null");
    }

    // ✅ Set response headers for streaming
    res.setHeader('Content-Disposition', `attachment; filename="${importTemplateFileInfo.fileName}"`);
    res.setHeader('Content-Type', importTemplateFileInfo.mimeType);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    // Pipe the stream to the response as an excel file
    importTemplateFileInfo.stream.pipe(res);
  }

  @ApiBearerAuth("jwt")
  @Get('/import-instructions/:modelMetadataId')
  async getImportInstructions(@Param('modelMetadataId') modelMetadataId: number) {
    // return this.service.getImportInstructions(modelMetadataId);
    return this.service.getImportInstructions(modelMetadataId);
  }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateImportTransactionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateImportTransactionDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateImportTransactionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateImportTransactionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
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
  @Get(':id/import-mapping-info')
  async getImportMappingInfo(@Param('id') id: string) {
    return this.service.getImportMappingInfo(+id);
  }

  @ApiBearerAuth("jwt")
  @Post(':id/import-mapping')
  async saveImportMapping(@Param('id') id: string) {
    return this.service.saveImportMapping(+id);
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
