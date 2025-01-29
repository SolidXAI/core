import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Post, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { MediaService } from '../services/media.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CreateMediaDto } from '../dtos/create-media.dto';
import { Public } from 'src/decorators/public.decorator';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

@Controller('media')
@ApiTags("App Builder")
export class MediaController {
    private logger = new Logger(MediaController.name);

    constructor(
        private readonly mediaService: MediaService
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
        return this.mediaService.findMany(basicFilterDto);
    }

    @ApiBearerAuth("jwt")
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.mediaService.findOne(id);
    }

    @ApiBearerAuth("jwt")
    @Post()
    create(@Body() createDto: CreateMediaDto) {
        // this.logger.log(`Creating a new model: ${JSON.stringify(createDto)}`);
        return this.mediaService.create(createDto);
    }

    @Public()
    @ApiBearerAuth("jwt")
    @Post('/upload')
    @UseInterceptors(AnyFilesInterceptor())
    upload(@UploadedFiles() files: Array<Express.Multer.File>, @Body() createDto: CreateMediaDto, ) {
        // this.logger.log(`Creating a new model: ${JSON.stringify(createDto)}`);
        return this.mediaService.upload(createDto, files);
    }



    // @Patch(':id')
    // update(@Param('id') id: number, @Body() updateCountryDto: UpdateCountryDto) {
    //     return this.countriesService.update(id, updateCountryDto);
    // }
    @ApiBearerAuth("jwt")
    @Delete('/bulk')
    async deleteMany(@Body() ids: number[]) {
      return this.mediaService.deleteMany(ids);
    }

    @ApiBearerAuth("jwt")
    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.mediaService.remove(id);
    }

}
