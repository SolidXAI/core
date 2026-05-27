import { ApiProperty, PartialType } from "@nestjs/swagger";
import { CreatePushNotificationTemplateDto } from "./create-push-notification-template.dto";
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

export class UpdatePushNotificationTemplateDto extends PartialType(CreatePushNotificationTemplateDto) {
  @IsNotEmpty()
  @IsOptional()
  @Matches(/[a-z]+(-[a-z]+)*/)
  @IsString()
  @ApiProperty()
  name: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  displayName: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  title: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  body: string;

  @IsOptional()
  @IsObject()
  @ApiProperty()
  dataTemplate?: Record<string, string>;

  @IsOptional()
  @IsString()
  @ApiProperty()
  description?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  active: boolean;

  @IsOptional()
  @IsString()
  @ApiProperty()
  type?: string;
}
