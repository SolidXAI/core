import { Controller, ForbiddenException, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from 'src/decorators/active-user.decorator';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { ChatterMessageArchiveService } from 'src/services/chatter-message-archive.service';

@ApiTags('Solid Core')
@ApiBearerAuth('jwt')
@Controller('chatter-message-archive')
export class ChatterMessageArchiveController {
  constructor(private readonly service: ChatterMessageArchiveService) {}

  private ensureAdmin(activeUser: ActiveUserData) {
    if (!activeUser?.roles?.includes('Admin')) throw new ForbiddenException();
  }

  @Get()
  async getMany(@Query() query: any, @ActiveUser() activeUser: ActiveUserData) {
    this.ensureAdmin(activeUser);
    const result = await this.service.getArchivedMessages(query);
    if (result === null) return { available: false, records: [], meta: { totalRecords: 0 } };
    return { available: true, ...result };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @ActiveUser() activeUser: ActiveUserData) {
    this.ensureAdmin(activeUser);
    const result = await this.service.getArchivedMessage(Number(id));
    if (result === null) throw new NotFoundException('Archived chatter message not found');
    return { available: true, record: result };
  }
}
