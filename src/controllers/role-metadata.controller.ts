import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoleMetadataService } from '../services/role-metadata.service';
import { CreateRoleMetadataDto } from '../dtos/create-role-metadata.dto';
import { UpdateRoleMetadataDto } from '../dtos/update-role-metadata.dto';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';

@ApiTags('Solid') 
@Controller('role-metadata') //FIXME: Change this to the model plural name 
export class RoleMetadataController {
  constructor(private readonly service: RoleMetadataService) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateRoleMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.create(createDto, files,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateRoleMetadataDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [],@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray,solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateRoleMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.update(id, updateDto, files,false,solidRequestContext);
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
  async delete (@Param('id') id: number,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.delete(id,solidRequestContext);
  }


}
