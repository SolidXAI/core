import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/decorators/public.decorator';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { CreateSettingDto } from '../dtos/create-setting.dto';
import { UpdateSettingDto } from '../dtos/update-setting.dto';
import { SettingService } from '../services/setting.service';

@ApiTags('Solid Core')
@Controller('setting') //FIXME: Change this to the model plural name 
export class SettingController {
  constructor(private readonly service: SettingService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateSettingDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.create(createDto, files, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateSettingDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray, solidRequestContext);
  }

  /**
   * Important to keep this method just above the @Put(':id') definition that follows as otherwise it will conflict. 
   * 
   * @param body 
   * @param files 
   * @returns 
   */
  @ApiBearerAuth("jwt")
  @Put('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  async updateSettings(@Body() body: any, @UploadedFiles() files: Array<Express.Multer.File>) {
    let settings: CreateSettingDto[] = [];

    try {
      settings = typeof body.settings === 'string' ? JSON.parse(body.settings) : body.settings;
    } catch (e) {
      throw new BadRequestException('Invalid settings payload');
    }
    return this.service.updateSettings(settings, files);
  }

  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateSettingDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, false, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateSettingDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, true, solidRequestContext);
  }

  @Get('/wrapped')
  @Public()
  async wrapSettings() {

    return this.service.getAllSettings();
    
  }

  @ApiBearerAuth("jwt")
  @Get()
  async getAllSettings() {
    return this.service.getAllSettings();
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'showHeader', required: false, type: String })
  @ApiQuery({ name: 'inListView', required: false, type: String })
  @Get('/get-mcp-url')
  getMcpUrl(@Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.getMcpUrl(query, solidRequestContext);

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
  async findMany(@Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.find(query, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Get(':id')
  async findOne(@Param('id') id: string, @Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.findOne(+id, query, solidRequestContext);
  }

  @Delete('/bulk')
  async deleteMany(@Body() ids: number[], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.deleteMany(ids, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  async delete(@Param('id') id: number, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.delete(id, solidRequestContext);
  }

  // @ApiBearerAuth("jwt")
  // @Post('/bulk/user')
  // @UseInterceptors(AnyFilesInterceptor())
  // async updateUserSettings(@Body() body: any, @UploadedFiles() files: Array<Express.Multer.File>) {
  //   let settings: CreateSettingDto[] = [];
  //   try {
  //     settings = typeof body.settings === 'string' ? JSON.parse(body.settings) : body.settings;
  //   } catch (e) {
  //     throw new BadRequestException('Invalid settings payload');
  //   }
  //   return this.service.updateSettings(settings, files);
  // }

}