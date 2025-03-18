import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { SmsTemplateService } from '../services/sms-template.service';
import { CreateSmsTemplateDto } from '../dtos/create-sms-template.dto';
import { UpdateSmsTemplateDto } from '../dtos/update-sms-template.dto';


@Controller('sms-templates')
@ApiTags("Common")
export class SmsTemplateController {
  constructor(private readonly smsTemplateService: SmsTemplateService) { }

  @ApiBearerAuth("jwt")
  @Roles('Admin')
  @Post()
  create(@Body() dto: CreateSmsTemplateDto) {
    return this.smsTemplateService.create(dto);
  }

  @ApiBearerAuth("jwt")
  @Roles('Admin')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })    
  @Get()
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.smsTemplateService.findAll(paginationQuery);
  }

  @ApiBearerAuth("jwt")
  @Roles('Admin')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.smsTemplateService.findOne(+id);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSmsTemplateDto) {
    return this.smsTemplateService.update(+id, dto);
  }

  @ApiBearerAuth("jwt")
  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.smsTemplateService.remove(+id);
  }
}
