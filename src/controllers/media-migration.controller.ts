import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CleanupMediaMigrationSourceDto, CreateMediaMigrationDto } from '../dtos/create-media-migration.dto';
import { MediaMigrationItem, MediaMigrationItemStatus } from '../entities/media-migration-item.entity';
import { MediaMigrationJob } from '../entities/media-migration-job.entity';
import { MediaMigrationService } from '../services/media-migration/media-migration.service';

/** Progress as a percentage of the files in scope that have reached a final result. */
function withProgress(job: MediaMigrationJob) {
  const done = (job.migratedCount ?? 0) + (job.failedCount ?? 0) + (job.skippedCount ?? 0);
  const progressPercent = job.totalCount > 0
    ? Math.min(100, Math.floor((done / job.totalCount) * 100))
    : (job.status === 'completed' ? 100 : 0);
  return { ...job, progressPercent };
}

/**
 * Media migration over HTTP. Access follows the usual permission rules: admins are granted these
 * methods automatically by the permission seeder. Nothing here runs a migration directly; start and
 * control are queued, and the job's own status shows what happens.
 */
@ApiTags('Solid Core')
@Controller('media-migration')
export class MediaMigrationController {
  constructor(
    private readonly service: MediaMigrationService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  @ApiBearerAuth('jwt')
  @Post('preview')
  preview(@Body() dto: CreateMediaMigrationDto) {
    return this.service.preview(dto);
  }

  @ApiBearerAuth('jwt')
  @Post()
  @HttpCode(202)
  async create(@Body() dto: CreateMediaMigrationDto) {
    return withProgress(await this.service.create(dto));
  }

  @ApiBearerAuth('jwt')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Get()
  async list(@Query('limit') limit = 20, @Query('offset') offset = 0) {
    const [records, total] = await this.dataSource.getRepository(MediaMigrationJob).findAndCount({
      relations: ['sourceProvider', 'targetProvider'],
      order: { id: 'DESC' },
      take: Math.min(Math.max(+limit, 1), 100),
      skip: Math.max(+offset, 0),
    });
    return { totalRecords: total, records: records.map(withProgress) };
  }

  @ApiBearerAuth('jwt')
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const job = await this.dataSource.getRepository(MediaMigrationJob).findOne({
      where: { id },
      relations: ['sourceProvider', 'targetProvider'],
    });
    if (!job) {
      throw new NotFoundException(`Media migration job #${id} not found`);
    }
    return withProgress(job);
  }

  @ApiBearerAuth('jwt')
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Get(':id/items')
  async items(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status?: MediaMigrationItemStatus,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    const [records, total] = await this.dataSource.getRepository(MediaMigrationItem).findAndCount({
      where: { job: { id }, ...(status ? { status } : {}) },
      order: { id: 'ASC' },
      take: Math.min(Math.max(+limit, 1), 200),
      skip: Math.max(+offset, 0),
    });
    return { totalRecords: total, records };
  }

  @ApiBearerAuth('jwt')
  @Post(':id/cancel')
  async cancel(@Param('id', ParseIntPipe) id: number) {
    return withProgress(await this.service.cancel(id));
  }

  @ApiBearerAuth('jwt')
  @Post(':id/resume')
  async resume(@Param('id', ParseIntPipe) id: number) {
    return withProgress(await this.service.resume(id));
  }

  @ApiBearerAuth('jwt')
  @Post(':id/retry-failed')
  async retryFailed(@Param('id', ParseIntPipe) id: number) {
    return withProgress(await this.service.retryFailed(id));
  }

  @ApiBearerAuth('jwt')
  @Post(':id/repoint-fields')
  async repointFields(@Param('id', ParseIntPipe) id: number) {
    return this.service.repoint(id);
  }

  @ApiBearerAuth('jwt')
  @Post(':id/rollback')
  async rollback(@Param('id', ParseIntPipe) id: number) {
    const { job, targetFilesLeft } = await this.service.rollback(id);
    return { ...withProgress(job), targetFilesLeft };
  }

  @ApiBearerAuth('jwt')
  @Post(':id/cleanup-source')
  cleanupSource(@Param('id', ParseIntPipe) id: number, @Body() dto: CleanupMediaMigrationSourceDto) {
    return this.service.cleanupSource(id, dto.confirm);
  }
}
