import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CreatePushNotificationTemplateDto } from "src/dtos/create-push-notification-template.dto";
import { UpdatePushNotificationTemplateDto } from "src/dtos/update-push-notification-template.dto";
import { PushNotificationTemplateService } from "src/services/push-notification-template.service";

@Controller("push-notification-template")
@ApiTags("Solid Core")
export class PushNotificationTemplateController {
  constructor(private readonly service: PushNotificationTemplateService) {}

  @ApiBearerAuth("jwt")
  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  create(
    @Body() createDto: CreatePushNotificationTemplateDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.service.create(createDto, files);
  }

  @ApiBearerAuth("jwt")
  @Post("/bulk")
  @UseInterceptors(AnyFilesInterceptor())
  insertMany(
    @Body() createDtos: CreatePushNotificationTemplateDto[],
    @UploadedFiles() filesArray: Express.Multer.File[][] = [],
  ) {
    return this.service.insertMany(createDtos, filesArray);
  }

  @ApiBearerAuth("jwt")
  @Put(":id")
  @UseInterceptors(AnyFilesInterceptor())
  update(
    @Param("id") id: number,
    @Body() updateDto: UpdatePushNotificationTemplateDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.service.update(id, updateDto, files);
  }

  @ApiBearerAuth("jwt")
  @ApiQuery({ name: "showSoftDeleted", required: false, type: Boolean })
  @ApiQuery({ name: "showOnlySoftDeleted", required: false, type: Boolean })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiQuery({ name: "fields", required: false, type: Array })
  @ApiQuery({ name: "sort", required: false, type: Array })
  @ApiQuery({ name: "groupBy", required: false, type: Array })
  @ApiQuery({ name: "populate", required: false, type: Array })
  @ApiQuery({ name: "populateMedia", required: false, type: Array })
  @ApiQuery({ name: "filters", required: false, type: Array })
  @Get()
  async findMany(@Query() query: any) {
    return this.service.find(query);
  }

  @ApiBearerAuth("jwt")
  @Get(":id")
  async findOne(@Param("id") id: string, @Query() query: any) {
    return this.service.findOne(+id, query);
  }

  @ApiBearerAuth("jwt")
  @Delete("/bulk")
  async deleteMany(@Body() ids: number[]) {
    return this.service.deleteMany(ids);
  }

  @ApiBearerAuth("jwt")
  @Delete(":id")
  async delete(@Param("id") id: number) {
    return this.service.delete(id);
  }
}
