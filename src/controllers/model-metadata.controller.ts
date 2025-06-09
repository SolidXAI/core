import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/decorators/public.decorator';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CreateModelMetadataDto } from '../dtos/create-model-metadata.dto';
import { UpdateModelMetaDataDto } from '../dtos/update-model-metadata.dto';
import { ModelMetadataService } from '../services/model-metadata.service';

@Controller('model-metadata')
@ApiTags("App Builder")
export class ModelMetadataController {
    private logger = new Logger('ModelMetadataController');

    constructor(
        private readonly modelMetadataService: ModelMetadataService
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
        return this.modelMetadataService.findMany(basicFilterDto);
    }

    @Public()
    @Get('public')
    async findManyPublic() {
        const basicFilterDto: BasicFilterDto = {
            fields: ['singularName'],
            limit: 10000,
            offset: 0,
            filters: [],
            groupBy: [],
            populate: [],
            populateMedia: [],
            sort: []
        }
        return this.modelMetadataService.findMany(basicFilterDto);
    }

    @ApiBearerAuth("jwt")
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Query() query: any) {
        return this.modelMetadataService.findOne(id, query);
    }

    @ApiBearerAuth("jwt")
    @Post()
    create(@Body() createDto: CreateModelMetadataDto) {
        // this.logger.log(`Creating a new model: ${JSON.stringify(createDto)}`);
        return this.modelMetadataService.create(createDto);
    }

    @Public()
    @Post('/update-user-key')
    updateUserKey(@Body() data: any) {
        return this.modelMetadataService.updateUserKey(data);
    }

    @ApiBearerAuth("jwt")
    @Post(':id/generate-code')
    generateCode(@Param('id', ParseIntPipe) id: number) {
        return this.modelMetadataService.handleGenerateCode({ modelId: id });
    }

    @ApiBearerAuth("jwt")
    @Put(':id')
    update(@Param('id') id: number, @Body() updateModelMetaDataDto: UpdateModelMetaDataDto) {
        return this.modelMetadataService.update(id, updateModelMetaDataDto);
    }

    @ApiBearerAuth("jwt")
    @Delete('/bulk')
    async deleteMany(@Body() ids: number[]) {
        return this.modelMetadataService.deleteMany(ids);
    }

    @ApiBearerAuth("jwt")
    @Delete(':id')
    async delete(@Param('id') id: number) {
        return this.modelMetadataService.remove(id);
    }

}
