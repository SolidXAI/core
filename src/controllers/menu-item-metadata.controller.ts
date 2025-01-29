import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiForbiddenResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MenuItemMetadataService } from '../services/menu-item-metadata.service';
import { CreateMenuItemMetadataDto } from '../dtos/create-menu-item-metadata.dto';
import { UpdateMenuItemMetadataDto } from '../dtos/update-menu-item-metadata.dto';
import { ActiveUser } from 'src/decorators/active-user.decorator';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';

@ApiTags('App')
@Controller('menu-item-metadata') //FIXME: Change this to the model plural name 
export class MenuItemMetadataController {
  constructor(private readonly service: MenuItemMetadataService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateMenuItemMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateMenuItemMetadataDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateMenuItemMetadataDto, @UploadedFiles() files: Array<Express.Multer.File>) {
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
