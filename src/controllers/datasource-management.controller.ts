import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateDatasourceManagementDto } from "../dtos/create-datasource-management.dto";
import { DatasourceManagementService } from "../services/datasource-management.service";

@Controller("datasource-management")
@ApiTags("Solid Core")
export class DatasourceManagementController {
    constructor(
        private readonly datasourceManagementService: DatasourceManagementService,
    ) { }

    @ApiBearerAuth("jwt")
    @Get()
    findMany() {
        return this.datasourceManagementService.findMany();
    }

    @ApiBearerAuth("jwt")
    @Post()
    create(@Body() createDto: CreateDatasourceManagementDto) {
        return this.datasourceManagementService.create(createDto);
    }
}
