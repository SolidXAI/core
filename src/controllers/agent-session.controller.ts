import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch, ParseIntPipe, Headers, UnauthorizedException, Header } from '@nestjs/common';
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AgentSessionService } from '../services/agent-session.service';
import { CreateAgentSessionDto } from '../dtos/create-agent-session.dto';
import { UpdateAgentSessionDto } from '../dtos/update-agent-session.dto';
import { ShowSoftDeleted } from '../enums/show-soft-deleted.enum';
import { ActiveUser } from '../decorators/active-user.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { AgentHubProcessManagerService } from '../services/agent-hub-process-manager.service';

@ApiTags('Agent Hub')
@Controller('agent-session')
export class AgentSessionController {
  constructor(private readonly service: AgentSessionService, private readonly manager: AgentHubProcessManagerService) {}

  private bearer(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();
    return authorization;
  }

  @ApiBearerAuth('jwt')
  @Get('inbox')
  listInbox(@Headers('authorization') authorization: string, @Query('review') review: string,
            @Query('offset') offset: string) {
    const start = Number(offset);
    return this.manager.listJobSessions(this.bearer(authorization), review === 'true',
      Number.isSafeInteger(start) && start > 0 ? start : 0);
  }

  @ApiBearerAuth('jwt')
  @Get('inbox/:sessionId')
  getInboxRun(@Headers('authorization') authorization: string, @Param('sessionId') sessionId: string) {
    return this.manager.getJobSession(this.bearer(authorization), sessionId);
  }

  @ApiBearerAuth('jwt')
  @Header('Cache-Control', 'no-store')
  @Post('inbox/:sessionId/connect')
  connectInboxRun(@Headers('authorization') authorization: string, @Param('sessionId') sessionId: string) {
    return this.manager.connectJobSession(this.bearer(authorization), sessionId);
  }

  @ApiBearerAuth('jwt')
  @Post('inbox/:sessionId/requests/:requestId/answer')
  answerInboxRun(@Headers('authorization') authorization: string, @Param('sessionId') sessionId: string,
                 @Param('requestId', ParseIntPipe) requestId: number, @Body() answer: unknown) {
    return this.manager.answerJobSession(this.bearer(authorization), sessionId, requestId, answer);
  }

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(@Body() createDto: CreateAgentSessionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk')
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(@Body() createDtos: CreateAgentSessionDto[], @UploadedFiles() filesArray: Express.Multer.File[][] = []) {
    return this.service.insertMany(createDtos, filesArray);
  }


  @ApiBearerAuth("jwt")
  @Put(':id')
  @UseInterceptors(AnyFilesInterceptor())
  update(@Param('id') id: number, @Body() updateDto: UpdateAgentSessionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  partialUpdate(@Param('id') id: number, @Body() updateDto: UpdateAgentSessionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    return this.service.update(id, updateDto, files, true);
  }

  @ApiBearerAuth("jwt")
  @Post('/bulk-recover')
  async recoverMany(@Body() ids: number[]) {
    return this.service.recoverMany(ids);
  }

  @ApiBearerAuth("jwt")
  @Get('/recover/:id')
  async recover(@Param('id') id: number) {
    return this.service.recover(id);
  }
    
  @ApiBearerAuth("jwt")
  @ApiQuery({ name: 'showSoftDeleted', required: false, enum: ShowSoftDeleted })
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  @Get(':id/messages')
  async messages(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page: string,
    @Query('page_size') pageSize: string,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    return this.service.getMessages(id, Number(page) || 1, Number(pageSize) || 50, activeUser);
  }

  @ApiBearerAuth("jwt")
  @Get(':id')
  async findOne(@Param('id') id: string, @Query() query: any) {
    return this.service.findOne(+id, query);
  }

  @ApiBearerAuth("jwt")
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
