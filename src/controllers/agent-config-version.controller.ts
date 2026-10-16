import { Controller, Post, Body, Param, UploadedFiles, UseInterceptors, Put, Get, Query, Delete, Patch } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateAgentConfigVersionDto } from '../dtos/create-agent-config-version.dto';
import { UpdateAgentConfigVersionDto } from '../dtos/update-agent-config-version.dto';
import { ShowSoftDeleted } from '../enums/show-soft-deleted.enum';
import { AgentConfigVersionRecordService } from '../services/agent-config-version-record.service';

@ApiTags('Agent Hub')
@Controller('agent-config-version')
export class AgentConfigVersionController {
    constructor(private readonly service: AgentConfigVersionRecordService) {}

    @ApiBearerAuth('jwt')
    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    create(@Body() dto: CreateAgentConfigVersionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
        return this.service.create(dto, files);
    }

    @ApiBearerAuth('jwt')
    @Post('/bulk')
    @UseInterceptors(AnyFilesInterceptor())
    insertMany(@Body() dtos: CreateAgentConfigVersionDto[], @UploadedFiles() files: Express.Multer.File[][] = []) {
        return this.service.insertMany(dtos, files);
    }

    @ApiBearerAuth('jwt')
    @Put(':id')
    @UseInterceptors(AnyFilesInterceptor())
    update(@Param('id') id: number, @Body() dto: UpdateAgentConfigVersionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
        return this.service.update(id, dto, files);
    }

    @ApiBearerAuth('jwt')
    @Patch(':id')
    @UseInterceptors(AnyFilesInterceptor())
    partialUpdate(@Param('id') id: number, @Body() dto: UpdateAgentConfigVersionDto, @UploadedFiles() files: Array<Express.Multer.File>) {
        return this.service.update(id, dto, files, true);
    }

    @ApiBearerAuth('jwt')
    @Post('/bulk-recover')
    recoverMany(@Body() ids: number[]) {
        return this.service.recoverMany(ids);
    }

    @ApiBearerAuth('jwt')
    @Get('/recover/:id')
    recover(@Param('id') id: number) {
        return this.service.recover(id);
    }

    @ApiBearerAuth('jwt')
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
    findMany(@Query() query: any) {
        return this.service.find(query);
    }

    @ApiBearerAuth('jwt')
    @Get(':id')
    findOne(@Param('id') id: string, @Query() query: any) {
        return this.service.findOne(+id, query);
    }

    @ApiBearerAuth('jwt')
    @Delete('/bulk')
    deleteMany(@Body() ids: number[]) {
        return this.service.deleteMany(ids);
    }

    @ApiBearerAuth('jwt')
    @Delete(':id')
    delete(@Param('id') id: number) {
        return this.service.delete(id);
    }
}
