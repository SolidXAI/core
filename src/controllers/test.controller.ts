import { Body, Controller, Get, Logger, Post, UploadedFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { AnyFilesInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { SolidRegistry } from "src/helpers/solid-registry";
import { Auth } from "src/decorators/auth.decorator";
import { Public } from "src/decorators/public.decorator";
import { AuthType } from "src/enums/auth-type.enum";

export class SeedData {
  seeder: string;
}

@Auth(AuthType.None)
@Controller('test')
@ApiTags("App Builder")
export class TestController {
  private readonly logger = new Logger(TestController.name);
  constructor(private readonly solidRegistry: SolidRegistry) { }

  @Auth(AuthType.None)
  @UseInterceptors(AnyFilesInterceptor())
  @Post('uploads')
  uploadData(@UploadedFiles() files: Array<Express.Multer.File>, @Body() body: any) {
    return { message: 'file uploaded', fileNames: files.map(f => f.originalname), formData: body };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // 'file' here is the name of the field in the form
  uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    console.log(file);
    console.log(body);
    return { filename: file.originalname };
  }

  @Public()
  @Post('seed')
  async seedData(@Body() seedData: any) {
    const seeder = this.solidRegistry
      .getSeeders()
      .filter((seeder) => seeder.name === seedData.seeder)
      .map((seeder) => seeder.instance)
      .pop();
    if (!seeder) {
      this.logger.error(`Seeder service ${seedData.seeder} not found. Does your service have a seed() method?`);
      return;
    }
    this.logger.log(`Running the seed() method for seeder :${seeder.constructor.name}`);
    await seeder.seed();
    return { message: `seed data for ${seedData.seeder}` };
  }

}
