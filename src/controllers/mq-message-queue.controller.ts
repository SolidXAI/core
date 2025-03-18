import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { CreateMqMessageQueueDto } from '../dtos/create-mq-message-queue.dto';
import { UpdateMqMessageQueueDto } from '../dtos/update-mq-message-queue.dto';
import { MqMessageQueueService } from '../services/mq-message-queue.service';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';

@ApiTags('Queues')
@Controller('mq-message-queue') //FIXME: Change this to the model plural name 
export class MqMessageQueueController {
  constructor(protected readonly service: MqMessageQueueService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateMqMessageQueueDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.create(createDto, files,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateMqMessageQueueDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [],@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray,solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateMqMessageQueueDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.update(id, updateDto, files,false,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
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

}