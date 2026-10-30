import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch, Logger } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { MutateUserRolesDto } from '../dtos/mutate-user-roles.dto';
import { MutateUserRolesBulkDto } from '../dtos/mutate-user-roles-list.dto';
import { ActiveUser } from '../decorators/active-user.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { SolidRequestContextDecorator } from 'src/decorators/solid-request-context.decorator';
import { SolidRequestContextDto } from 'src/dtos/solid-request-context.dto';
import { UpdateUserProfileDto } from 'src/dtos/update-user-profile.dto';

@ApiTags('Solid Core')
@Controller('user') //FIXME: Change this to the model plural name
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly service: UserService) { }

  /**
   * @deprecated Bypasses `AuthenticationService.signUp`, so it never runs
   * `initializeRolesForNewUser` - a user created here gets no role at all, not even
   * the "Internal User" baseline, and none of the SignupIntent dispatch introduced
   * alongside the extension-user provider work applies. Use `POST /iam/register-private`
   * (an authenticated core user, with roles you name) or the extension model's own
   * generated create endpoint instead.
   *
   * A workspace-wide search (frontends and backend callers across every consuming app
   * in this monorepo) found no caller as of 2026-09-11. Kept for one deprecation cycle
   * in case an external caller exists outside this workspace - the warning below is
   * how that would surface - before being removed in a future major version.
   */
  @ApiOperation({
    deprecated: true,
    description: 'Deprecated: creates a user with no role assignment, not even the default. Use POST /iam/register-private, or the extension model\'s own create endpoint, instead. Scheduled for removal in a future major version.',
  })
  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateUserDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    this.logger.warn(
      `Deprecated endpoint POST /user was called (username="${createDto?.username}"). ` +
      'This bypasses role assignment entirely and is scheduled for removal. ' +
      'Use POST /iam/register-private or the extension model\'s own create endpoint.',
    );
    return this.service.create(createDto, files, solidRequestContext);
  }

  /** @deprecated See {@link create} - same gap, applied per row. */
  @ApiOperation({
    deprecated: true,
    description: 'Deprecated: creates users with no role assignment, not even the default. Use the extension model\'s own bulk-create endpoint, or repeated calls to POST /iam/register-private, instead. Scheduled for removal in a future major version.',
  })
  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateUserDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = [], @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    this.logger.warn(
      `Deprecated endpoint POST /user/bulk was called (count=${createDtos?.length ?? 0}, ` +
      `usernames=${createDtos?.map(dto => dto.username).join(', ')}). ` +
      'This bypasses role assignment entirely and is scheduled for removal.',
    );
    return this.service.insertMany(createDtos, filesArray, solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.update(id, updateDto, files, false, solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Patch(':id/update-user-and-roles')
  updateUser(@Param('id') id: number, @Body() updateDto: any, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.updateUser(id, updateDto, files, solidRequestContext);
  }


  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateUserDto, @UploadedFiles() files: Array<Express.Multer.File>, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
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
  async findMany(@Query() query: any, @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto) {
    return this.service.find(query, solidRequestContext);
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'permissionNames', required: false, type: Array })
  @Get('/permissions-exists')
  async checkIfPermissionExists(@Query() query: any, @ActiveUser() activeUser: ActiveUserData) {
    return this.service.checkIfPermissionExists(query, activeUser);
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
    @Body() updateDto: UpdateUserProfileDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @SolidRequestContextDecorator() solidRequestContext: SolidRequestContextDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.service.update(user.sub, updateDto, files, true, solidRequestContext);
  }
}
