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

  @Get('/wrapped')
  @Public()
  async wrapSettings() {
    return this.service.getSystemAdminReadonlyAndAboveSettings();
  }

  @ApiBearerAuth("jwt")
  @Get()
  async getAllSettings() {
    return this.service.getSystemAdminReadonlyAndAboveSettings();
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'showHeader', required: false, type: String })
  @ApiQuery({ name: 'inListView', required: false, type: String })
  @Get('/get-mcp-url')
  getMcpUrl(@Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.getMcpUrl(query, solidRequestContext);

  }

}