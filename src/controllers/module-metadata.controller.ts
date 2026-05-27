import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CreateModuleMetadataDto } from '../dtos/create-module-metadata.dto';
import { UpdateModuleMetadataDto } from '../dtos/update-module-metadata.dto';
import { ModuleMetadataService } from '../services/module-metadata.service';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('module-metadata')
@ApiTags("Solid Core")
export class ModuleMetadataController {
  constructor(private readonly moduleMetadataService: ModuleMetadataService) { }

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
  async findMany(
    @Query() basicFilterDto: BasicFilterDto
  ) {
    return this.moduleMetadataService.findMany(basicFilterDto);
  }


  @ApiBearerAuth("jwt")
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.moduleMetadataService.findOne(id);
  }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateModuleMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.moduleMetadataService.create(createDto,files);
  }

  @ApiBearerAuth("jwt")
  @Post('/refresh-permission')
  refreshPermission() {
    return this.moduleMetadataService.refreshPermission();
  }

  @ApiBearerAuth("jwt")
  @Post(':id/generate-code')
  generateCode(@Param('id', ParseIntPipe) id: number) {
    return this.moduleMetadataService.generateCodeViaCtl(id);
  }
 


  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateModuleMetadataDto: UpdateModuleMetadataDto , @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.moduleMetadataService.update(id, updateModuleMetadataDto,files);
  }

  @ApiBearerAuth("jwt")
  @Delete('/bulk')
  async deleteMany(@Body() ids: number[]) {
    return this.moduleMetadataService.deleteMany(ids);
  }


  @ApiBearerAuth("jwt")
  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.moduleMetadataService.remove(id);
  }
}
