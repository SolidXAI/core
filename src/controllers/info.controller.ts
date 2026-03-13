import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InfoService } from '../services/info.service';

@ApiTags('Solid Core')
@ApiBearerAuth('jwt')
@Controller('info')
export class InfoController {
    constructor(private readonly infoService: InfoService) {}

    @Get('/versions')
    getVersions() {
        return this.infoService.getPackageVersions();
    }
}
