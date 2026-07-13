import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateMediaDto } from 'src/dtos/create-media.dto';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { UpdateMediaDto } from 'src/dtos/update-media.dto';
import { MediaService } from 'src/services/media.service';
import { Response } from 'express';

enum ShowSoftDeleted {
  INCLUSIVE = "inclusive",
  EXCLUSIVE = "exclusive",
}

@ApiTags('Solid Core')
@Controller('media')
// @UseGuards(ThrottlerGuard)
// @SkipThrottle({ short: true, login: true, burst: true, sustained: true }) //Skip all
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateMediaDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.create(createDto, files, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateMediaDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray, solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateMediaDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, false, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateMediaDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, true, solidRequestContext);
  }

  // @Public()
  // @SkipThrottle({ short: false, login: true, burst: true, sustained: true }) //Enable the short throttle only
  @ApiBearerAuth("jwt")
  @Post('/upload')
  @UseInterceptors(AnyFilesInterceptor())
  upload(@UploadedFiles() files: Array<Express.Multer.File>, @Body() createDto: CreateMediaDto, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
      // this.logger.log(`Creating a new model: ${JSON.stringify(createDto)}`);
      return this.service.upload(createDto, files, solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Post('/bulk-recover')
  async recoverMany(@Body() ids: number[], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.recoverMany(ids, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Get('/recover/:id')
  async recover(@Param('id') id: number, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.recover(id, solidRequestContext);
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
  async findMany(@Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.find(query, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    const media = await this.service.findOne(+id, {}, solidRequestContext);
    const { stream, fileName, mimeType, redirectUrl } = await this.service.fileDownloadStream(media);

    if (redirectUrl) {
      return res.redirect(302, redirectUrl);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    stream.pipe(res);
  }

  @ApiBearerAuth("jwt")
  @Get(':id')
  async findOne(@Param('id') id: string, @Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.findOne(+id, query, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Delete('/bulk')
  async deleteMany(@Body() ids: number[], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.deleteMany(ids, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  async delete(@Param('id') id: number, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.delete(id, solidRequestContext);
  }


}
