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

@ApiTags('Solid')
@Controller('user') //FIXME: Change this to the model plural name 
export class UserController {
  constructor(private readonly service: UserService) { }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateUserDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateUserDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files, true);
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

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'permissionNames', required: false, type: Array })
  @Get('/permissions-exists')
  async checkIfPermissionExists(@Query() query: any, @ActiveUser() activeUser: ActiveUserData) {
    return this.service.checkIfPermissionExists(query, activeUser);
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


}
