import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SolidRegistry } from "src/helpers/solid-registry";
import { Auth } from "src/decorators/auth.decorator";
import { AuthType } from "src/enums/auth-type.enum";
import { IngestMetadataService } from "src/services/genai/ingest-metadata.service";
import { Public } from "src/decorators/public.decorator";
import { DeviceMetadataDto } from "src/dtos/device-metadata.dto";
import { FirebasePushNotificationService } from "src/services/push/firebase-push-notification.service";

export class SeedData {
  seeder: string;
}

@Controller("test")
@ApiTags("Solid Core")
export class TestController {
  private readonly logger = new Logger(TestController.name);
  constructor(
    private readonly solidRegistry: SolidRegistry,
    private readonly ingestMetadataService: IngestMetadataService,
    private readonly firebasePushNotificationService: FirebasePushNotificationService,
  ) {}

  @Auth(AuthType.None)
  @UseInterceptors(AnyFilesInterceptor())
  @Post("uploads")
  uploadData(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: any,
  ) {
    return {
      message: "file uploaded",
      fileNames: files.map((f) => f.originalname),
      formData: body,
    };
  }

  @Auth(AuthType.None)
  @Post("upload")
  @UseInterceptors(FileInterceptor("file")) // 'file' here is the name of the field in the form
  uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    // console.log(file);
    this.logger.debug(file);
    // console.log(body);
    this.logger.debug(body);
    return { filename: file.originalname };
  }

  @ApiBearerAuth("jwt")
  @Post("mcp/ingest")
  @UseInterceptors(FileInterceptor("file"))
  async mcpIngest(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    await this.ingestMetadataService.ingest();
    return { ok: true };
  }

  @Public()
  @Post("push")
  @HttpCode(HttpStatus.OK)
  async testPushNotification(@Body() payload: DeviceMetadataDto) {
    if (!payload.deviceToken?.trim()) {
      throw new Error("Device token is required");
    }

    return this.firebasePushNotificationService.testPushNotification(payload);
  }
}
