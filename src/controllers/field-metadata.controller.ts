import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { CreateFieldMetadataDto } from '../dtos/create-field-metadata.dto';
import { FieldMetadataService } from '../services/field-metadata.service';
import { Public } from 'src/decorators/public.decorator';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { SelectionDynamicQueryDto } from '../dtos/selection-dynamic-query.dto';

@Controller('field-metadata')
@ApiTags("App Builder")
export class FieldMetadataController {

    constructor(
        private readonly fieldMetadataService: FieldMetadataService
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
        return this.fieldMetadataService.findMany(basicFilterDto);
    }

    @ApiBearerAuth("jwt")
    @Get('/default')
    async findFieldDefaultMetaData() {
        return this.fieldMetadataService.findFieldDefaultMetaData();
    }

    @ApiBearerAuth("jwt")
    @Get('/selection-dynamic-values')
    async getSelectionDynamicValues(@Query() query: SelectionDynamicQueryDto) {
        return this.fieldMetadataService.getSelectionDynamicValues(query);
    }

    @ApiBearerAuth("jwt")
    @Get('/selection-dynamic-value')
    async getSelectionDynamicValue(@Query() query: SelectionDynamicQueryDto) {
        return this.fieldMetadataService.getSelectionDynamicValue(query);
    }

    @ApiBearerAuth("jwt")
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Query() query: any) {
        return this.fieldMetadataService.findOne(id, query);
    }

    @ApiBearerAuth("jwt")
    @Post()
    create(@Body() createDtos: CreateFieldMetadataDto[]) {
        return Promise.all(createDtos.map(dto => this.fieldMetadataService.create(dto)));
    }

    @ApiBearerAuth("jwt")
    @Delete(':id')
    async delete(@Param('id') id: number) {
        return this.fieldMetadataService.remove(id);
    }



}
