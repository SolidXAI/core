import {
    Controller,
    Get,
    Param,
    Post,
    Body,
    Res,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfirmModulePackageImportDto } from 'src/dtos/confirm-module-package-import.dto';
import { RunModulePackageBuildDto } from 'src/dtos/run-module-package-build.dto';
import { RunModulePackageSeedDto } from 'src/dtos/run-module-package-seed.dto';
import { ModulePackageService } from 'src/services/module-package.service';

@Controller('module-packages')
@ApiTags('Solid Core')
export class ModulePackageController {
    constructor(
        private readonly modulePackageService: ModulePackageService,
    ) { }

    @ApiBearerAuth('jwt')
    @Post('import/validate')
    @UseInterceptors(AnyFilesInterceptor())
    async validateImportPackage(
        @UploadedFiles() files: Array<Express.Multer.File>,
    ) {
        return this.modulePackageService.validateUpload(files?.[0]);
    }

    @ApiBearerAuth('jwt')
    @Get('export/:moduleName')
    async exportModulePackage(
        @Param('moduleName') moduleName: string,
        @Res() res: Response,
    ) {
        const archive = await this.modulePackageService.exportModulePackage(moduleName);
        res.setHeader('Content-Disposition', `attachment; filename="${archive.fileName}"`);
        res.setHeader('Content-Type', archive.mimeType);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
        res.sendFile(archive.filePath);
    }

    @ApiBearerAuth('jwt')
    @Get('import/resumable/latest')
    async getLatestResumableImport() {
        return this.modulePackageService.getLatestResumableImport();
    }

    @ApiBearerAuth('jwt')
    @Post('import/:id/confirm')
    async confirmImport(
        @Param('id') id: string,
        @Body() dto: ConfirmModulePackageImportDto,
    ) {
        return this.modulePackageService.confirmImport(id, dto);
    }

    @ApiBearerAuth('jwt')
    @Post('import/:id/dismiss')
    async dismissImport(
        @Param('id') id: string,
    ) {
        return this.modulePackageService.dismissImport(id);
    }

    @ApiBearerAuth('jwt')
    @Get('import/:id/status')
    async getImportStatus(
        @Param('id') id: string,
    ) {
        return this.modulePackageService.getStatus(id);
    }

    @ApiBearerAuth('jwt')
    @Post('import/:id/build')
    async runBuild(
        @Param('id') id: string,
        @Body() dto: RunModulePackageBuildDto,
    ) {
        return this.modulePackageService.runBuild(id, dto);
    }

    @ApiBearerAuth('jwt')
    @Post('import/:id/seed')
    async runSeed(
        @Param('id') id: string,
        @Body() dto: RunModulePackageSeedDto,
    ) {
        return this.modulePackageService.runSeed(id, dto);
    }
}
