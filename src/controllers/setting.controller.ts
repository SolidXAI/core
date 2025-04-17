import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SettingService } from '../services/setting.service';
import { CreateSettingDto } from '../dtos/create-setting.dto';
import { UpdateSettingDto } from '../dtos/update-setting.dto';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { UpdateSettingsDto } from 'src/dtos/update-settings.dto';

@ApiTags('Solid') 
@Controller('setting') //FIXME: Change this to the model plural name 
export class SettingController {
  constructor(private readonly service: SettingService) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateSettingDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.create(createDto, files,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateSettingDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [],@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray,solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateSettingDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.update(id, updateDto, files,false,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateSettingDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, true,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Get('/wrapped')
  async wrapSettings() {
      return this.service.wrapSettings();
  }

  @Get()
  async getAllSettings() {
    return this.service.getAllSettings();
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
  async findMany(@Query() query: any,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) { 
    return this.service.find(query,solidRequestContext);  
  }

  @ApiBearerAuth("jwt")
  @Get(':id')
  async findOne(@Param('id') id: string, @Query() query: any,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.findOne(+id, query,solidRequestContext);
  }

  @Delete('/bulk')
  async deleteMany(@Body() ids: number[],@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.deleteMany(ids,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  async delete(@Param('id') id: number,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.delete(id,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk-update')
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    return this.service.updateSettings(updateSettingsDto.settings);
  }
}
