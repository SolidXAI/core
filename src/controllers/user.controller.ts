import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiForbiddenResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { MutateUserRolesDto } from '../dtos/mutate-user-roles.dto';
import { MutateUserRolesBulkDto } from '../dtos/mutate-user-roles-list.dto';
import { ActiveUser } from '../decorators/active-user.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';

@ApiTags('Solid Core')
@Controller('user') //FIXME: Change this to the model plural name 
export class UserController {
  constructor(private readonly service: UserService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateUserDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.create(createDto, files,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateUserDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [],@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.insertMany(createDtos, filesArray,solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @UploadedFiles() files: Array<Express.Multer.File> ,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.update(id, updateDto, files,false,solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Patch(':id/update-user-and-roles')
  updateUser(@Param('id') id: number,@Body() updateDto: any, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.updateUser(id, updateDto, files,solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @UploadedFiles() files: Array<Express.Multer.File>,@SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, true, solidRequestContext);
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
  async findMany(@Query() query: any, @SolidRequestContextDecorator() solidRequestContext:SolidRequestContextDto) {
    return this.service.find(query,solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'permissionNames', required: false, type: Array })
  @Get('/permissions-exists')
  async checkIfPermissionExists(@Query() query: any, @ActiveUser() activeUser: ActiveUserData) {
    return this.service.checkIfPermissionExists(query, activeUser);
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
    return this.service.delete(id, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @Post('roles')
  addRoleToUser(@Body() mutateUserRoles: MutateUserRolesDto) {
    return this.service.addRoleToUser(mutateUserRoles.username, mutateUserRoles.roleName);
  }

  @ApiBearerAuth("jwt")
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @Post('roles/bulk')
  addRolesToUser(@Body() mutateUserRolesBulk: MutateUserRolesBulkDto) {
    return this.service.addRolesToUser(mutateUserRolesBulk.username, mutateUserRolesBulk.roleNames);
  }

  @ApiBearerAuth("jwt")
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @Delete('roles')
  removeRoleFromUser(userEmail: string, roleName: string) {
    return this.service.removeRoleFromUser(userEmail, roleName);
  }

  @ApiBearerAuth('jwt')
  @Post('/profile')
  @UseInterceptors(AnyFilesInterceptor())
  async updateOwnProfile(
    @Body() updateDto: UpdateUserDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.service.updateUser(user.sub, updateDto, files, solidRequestContext);
  }


}
