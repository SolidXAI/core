import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiForbiddenResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MenuItemMetadataService } from '../services/menu-item-metadata.service';
import { CreateMenuItemMetadataDto } from '../dtos/create-menu-item-metadata.dto';
import { UpdateMenuItemMetadataDto } from '../dtos/update-menu-item-metadata.dto';
import { ActiveUser } from 'src/decorators/active-user.decorator';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';

@ApiTags('Solid Core')
@Controller('menu-item-metadata') //FIXME: Change this to the model plural name 
export class MenuItemMetadataController {
  constructor(private readonly service: MenuItemMetadataService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateMenuItemMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.create(createDto, files, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateMenuItemMetadataDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray, solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateMenuItemMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, false, solidRequestContext);
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

  // /api/solid-menu-item/me
  @ApiBearerAuth("jwt")
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @Get('me')
  findUserMenus(@ActiveUser() activeUser: ActiveUserData) {
    // TODO: Use the menu service method to get a list of menus applicable to this user based on their role.
    return this.service.findUserMenus(activeUser);
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

  @ApiBearerAuth('jwt')
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateMenuItemMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files, true);
  }
}
