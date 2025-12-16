import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Post, Put, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { CreateMediaStorageProviderMetadataDto } from '../dtos/create-media-storage-provider-metadata.dto';
import { MediaStorageProviderMetadataService } from '../services/media-storage-provider-metadata.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { UpdateMediaStorageProviderMetadataDto } from '../dtos/update-media-storage-provider.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('media-storage-provider-metadata')
@ApiTags("Solid Core")
export class MediaStorageProviderMetadataController {
    private logger = new Logger(MediaStorageProviderMetadataController.name);

    constructor(
        private readonly mediaStorageProviderService: MediaStorageProviderMetadataService
    ) { }


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
        return this.mediaStorageProviderService.findMany(basicFilterDto);
    }

    @ApiBearerAuth("jwt")
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.mediaStorageProviderService.findOne(id);
    }

    @ApiBearerAuth("jwt")
    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    create(@Body() createDto: CreateMediaStorageProviderMetadataDto) {
        // this.logger.log(`Creating a new model: ${JSON.stringify(createDto)}`);
        return this.mediaStorageProviderService.create(createDto);
    }

    @Put(':id')
    @UseInterceptors(AnyFilesInterceptor())
    update(@Param('id') id: number, @Body() updateMediaStorageProviderMetadataDto: UpdateMediaStorageProviderMetadataDto) {
        return this.mediaStorageProviderService.update(id, updateMediaStorageProviderMetadataDto);
    }
    @ApiBearerAuth("jwt")
    @Delete('/bulk')
    async deleteMany(@Body() ids: number[]) {
        return this.mediaStorageProviderService.deleteMany(ids);
    }

    @ApiBearerAuth("jwt")
    @Delete(':id')
    delete(@Param('id') id: number) {
        return this.mediaStorageProviderService.delete(id);
    }

}
