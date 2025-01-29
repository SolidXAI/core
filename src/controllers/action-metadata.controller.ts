import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActionMetadataService } from '../services/action-metadata.service';
import { CreateActionMetadataDto } from '../dtos/create-action-metadata.dto';
import { UpdateActionMetadataDto } from '../dtos/update-action-metadata.dto';

@ApiTags('App')
@Controller('action-metadata') //FIXME: Change this to the model plural name 
export class ActionMetadataController {
  constructor(private readonly service: ActionMetadataService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateActionMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateActionMetadataDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }

  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateActionMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
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
}
