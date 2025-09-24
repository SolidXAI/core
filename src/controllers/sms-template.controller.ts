import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/decorators/public.decorator';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dtos/update-sms-template.dto';
import { SmsTemplateService } from '../services/sms-template.service';


@Controller('sms-template')
@ApiTags("Common")
// @UseGuards(ThrottlerGuard)
// @SkipThrottle({ short: false, login: true, burst: true, sustained: true }) //Enable the short throttle only
export class SmsTemplateController {
  constructor(private readonly service: SmsTemplateService) { }

   @Public()
    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    create(@Body() createDto: CreateSmsTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
      return this.service.create(createDto, files);
    }
  
    @Public()
    @Post('/bulk')
    @UseInterceptors(AnyFilesInterceptor())
    insertMany(@Body() createDtos: CreateSmsTemplateDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
      return this.service.insertMany(createDtos, filesArray);
    }
  
    @Public()
    @Put(':id')
    @UseInterceptors(AnyFilesInterceptor())
    update(@Param('id') id: number, @Body() updateDto: UpdateSmsTemplateDto, @UploadedFiles() files: Array<Express.Multer.File>) {
      return this.service.update(id, updateDto, files);
    }
  
    @Public()
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
  
    @Public()
    @Get(':id')
    async findOne(@Param('id') id: string, @Query() query: any) {
      return this.service.findOne(+id, query);
    }
  
    @Delete('/bulk')
    async deleteMany(@Body() ids: number[]) {
      return this.service.deleteMany(ids);
    }
  
    @Public()
    @Delete(':id')
    async delete(@Param('id') id: number) {
      return this.service.delete(id);
    }
}
